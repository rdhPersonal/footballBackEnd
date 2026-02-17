import type { ScheduledEvent } from 'aws-lambda';
import { Client } from 'pg';
import {
  fetchTeams,
  fetchTeamRoster,
  fetchPlayerGamelog,
  delay,
} from '../../shared/external-api/client';

const API_DELAY_MS = 300;
const CURRENT_SEASON = new Date().getFullYear();

function getDbClient(): Client {
  return new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'football',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
}

export async function handler(event: ScheduledEvent): Promise<void> {
  console.log('syncPlayerData triggered', JSON.stringify(event));

  const db = getDbClient();
  await db.connect();

  try {
    const season = CURRENT_SEASON;
    console.log(`Syncing data for ${season} season...`);

    // Fetch teams
    const teams = await fetchTeams();
    console.log(`Found ${teams.length} teams`);

    let playersProcessed = 0;
    let statsInserted = 0;

    for (const team of teams) {
      await delay(API_DELAY_MS);
      console.log(`Processing ${team.abbreviation}...`);

      const roster = await fetchTeamRoster(team.espnId);

      for (const player of roster) {
        if (!['QB', 'RB', 'WR', 'TE', 'K'].includes(player.positionAbbr)) continue;

        const dob = player.dateOfBirth ? player.dateOfBirth.split('T')[0] : null;

        // Upsert player
        const playerResult = await db.query(
          `INSERT INTO players (external_id, name, position, photo_url, date_of_birth, college, height_inches, weight_lbs)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (external_id) DO UPDATE SET
             name = EXCLUDED.name, position = EXCLUDED.position,
             photo_url = EXCLUDED.photo_url, updated_at = NOW()
           RETURNING id`,
          [player.espnId, player.fullName, player.positionAbbr, player.headshotUrl || null,
           dob, player.college || null, player.heightInches || null, player.weightLbs || null],
        );
        const playerId = playerResult.rows[0].id;

        await delay(API_DELAY_MS);

        // Fetch current season gamelog
        const gamelog = await fetchPlayerGamelog(player.espnId, season);
        if (!gamelog || gamelog.games.length === 0) continue;

        const sortedGames = [...gamelog.games].sort((a, b) => a.week - b.week);

        // Upsert roster stint
        await db.query(
          `INSERT INTO team_rosters (player_id, team_abbr, season, week_start, week_end, roster_status, transaction_type)
           VALUES ($1, $2, $3, $4, $5, 'active', 'signed')
           ON CONFLICT (player_id, season, week_start) DO UPDATE SET
             week_end = EXCLUDED.week_end`,
          [playerId, team.abbreviation, season, sortedGames[0].week, sortedGames[sortedGames.length - 1].week],
        );

        // Upsert game stats
        for (const game of sortedGames) {
          await db.query(
            `INSERT INTO player_stats (player_id, team_abbr, season, week, games_played, total_points, stat_details)
             VALUES ($1, $2, $3, $4, 1, 0, $5)
             ON CONFLICT (player_id, season, week) DO UPDATE SET
               stat_details = EXCLUDED.stat_details, updated_at = NOW()`,
            [playerId, team.abbreviation, season, game.week, JSON.stringify(game.stats)],
          );
          statsInserted++;
        }

        playersProcessed++;
      }
    }

    console.log(`Sync complete: ${playersProcessed} players, ${statsInserted} stat rows`);
  } finally {
    await db.end();
  }
}
