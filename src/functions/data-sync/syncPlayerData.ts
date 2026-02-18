import type { ScheduledEvent } from 'aws-lambda';
import { Client } from 'pg';
import {
  fetchTeams,
  fetchTeamRoster,
  fetchPlayerGamelog,
  delay,
} from '../../shared/external-api/client';

const API_DELAY_MS = 300;

// Advisory lock ID used to prevent concurrent sync runs.
// Arbitrary fixed integer; must be consistent across all sync invocations.
const SYNC_LOCK_ID = 738291;

// Minimum number of trailing weeks to always reprocess so that late
// stat corrections from ESPN converge. Full-season reprocessing is the
// default (SYNC_TRAILING_WEEKS=0 or unset), but when set to a positive
// value only the most recent N weeks are written — with a floor of 2.
const MIN_TRAILING_WEEKS = 2;

/**
 * Derive the current NFL season year.
 * The NFL season spans Sep-Feb, so Jan/Feb/Mar belong to the prior year's season.
 * Can be overridden via NFL_SEASON env var for manual control.
 */
function getNflSeason(): number {
  if (process.env.NFL_SEASON) {
    const override = parseInt(process.env.NFL_SEASON, 10);
    if (!Number.isNaN(override)) return override;
  }

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  return month <= 2 ? year - 1 : year;
}

function getTrailingWeeks(): number {
  const raw = process.env.SYNC_TRAILING_WEEKS;
  if (!raw) return 0; // 0 = full season
  const val = parseInt(raw, 10);
  if (Number.isNaN(val) || val <= 0) return 0;
  return Math.max(val, MIN_TRAILING_WEEKS);
}

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
    // Acquire an advisory lock to prevent concurrent sync runs (e.g. overlapping
    // scheduled + manual invocations). The lock is released when the connection closes.
    const lockResult = await db.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [SYNC_LOCK_ID],
    );
    if (!lockResult.rows[0].acquired) {
      console.log('Another sync is already running — exiting early.');
      return;
    }
    console.log('Advisory lock acquired.');

    const season = getNflSeason();
    const trailingWeeks = getTrailingWeeks();
    console.log(`Syncing data for ${season} season (trailing window: ${trailingWeeks || 'full season'})...`);

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

        const gamelog = await fetchPlayerGamelog(player.espnId, season);
        if (!gamelog || gamelog.games.length === 0) continue;

        const sortedGames = [...gamelog.games].sort((a, b) => a.week - b.week);

        // Apply trailing-window filter: when configured, only write the most recent N weeks.
        // This ensures late corrections in the trailing window are always picked up.
        let gamesToWrite = sortedGames;
        if (trailingWeeks > 0 && sortedGames.length > 0) {
          const maxWeek = sortedGames[sortedGames.length - 1].week;
          const cutoff = maxWeek - trailingWeeks;
          gamesToWrite = sortedGames.filter((g) => g.week > cutoff);
        }

        // Derive stint boundaries from the full gamelog (not the trailing window)
        // so the roster record always reflects the complete season span.
        const firstWeek = sortedGames[0].week;
        const lastWeek = sortedGames[sortedGames.length - 1].week;

        // Wrap all writes for this player in a transaction for atomicity
        await db.query('BEGIN');
        try {
          await db.query(
            `INSERT INTO team_rosters (player_id, team_abbr, season, week_start, week_end, roster_status, transaction_type)
             VALUES ($1, $2, $3, $4, $5, 'active', 'signed')
             ON CONFLICT (player_id, season, week_start) DO UPDATE SET
               week_end = GREATEST(team_rosters.week_end, EXCLUDED.week_end)`,
            [playerId, team.abbreviation, season, firstWeek, lastWeek],
          );

          for (const game of gamesToWrite) {
            await db.query(
              `INSERT INTO player_stats (player_id, team_abbr, season, week, event_id, games_played, total_points, stat_details)
               VALUES ($1, $2, $3, $4, $5, 1, 0, $6)
               ON CONFLICT (player_id, season, week) DO UPDATE SET
                 team_abbr = EXCLUDED.team_abbr,
                 event_id = EXCLUDED.event_id,
                 stat_details = EXCLUDED.stat_details,
                 updated_at = NOW()`,
              [playerId, team.abbreviation, season, game.week, game.eventId, JSON.stringify(game.stats)],
            );
            statsInserted++;
          }

          await db.query('COMMIT');
        } catch (txErr) {
          await db.query('ROLLBACK');
          console.error(`  [ERROR] Transaction failed for ${player.fullName}: ${txErr instanceof Error ? txErr.message : txErr}`);
          continue;
        }

        playersProcessed++;
      }
    }

    console.log(`Sync complete: ${playersProcessed} players, ${statsInserted} stat rows`);
  } finally {
    await db.end();
  }
}
