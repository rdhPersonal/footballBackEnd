import type { ScheduledEvent } from 'aws-lambda';
import { Client } from 'pg';
import {
  fetchTeams,
  fetchTeamRoster,
  fetchPlayerGamelog,
  delay,
  type EspnGameStat,
} from '../../shared/external-api/client';
import { parseGameStats } from '../../shared/stat-parser';
import { upsertGameStats } from '../../shared/db/writes/statWrites';
import { getDatabaseConnectionConfig } from '../../shared/db/runtime-config';

const API_DELAY_MS = 300;

// Advisory lock ID used to prevent concurrent sync runs.
// Arbitrary fixed integer; must be consistent across all sync invocations.
const SYNC_LOCK_ID = 738291;

// Minimum number of trailing weeks to always reprocess so that late
// stat corrections from ESPN converge. Full-season reprocessing is the
// default (SYNC_TRAILING_WEEKS=0 or unset), but when set to a positive
// value only the most recent N weeks are written — with a floor of 2.
const MIN_TRAILING_WEEKS = 2;

type DerivedStint = {
  teamAbbr: string;
  weekStart: number;
  weekEnd: number;
  rosterStatus: 'active' | 'practice_squad';
  transactionType: 'signed' | 'traded' | 'promoted' | 'demoted';
};

function deriveRosterStintsFromGames(games: EspnGameStat[], fallbackTeamAbbr: string): DerivedStint[] {
  if (games.length === 0) return [];

  const normalized = games
    .map((g) => ({
      ...g,
      teamAbbr: g.teamAbbr || fallbackTeamAbbr || 'UNK',
    }))
    .sort((a, b) => a.week - b.week);

  const stints: DerivedStint[] = [];
  let prev: DerivedStint | null = null;

  for (const game of normalized) {
    if (!prev) {
      prev = {
        teamAbbr: game.teamAbbr,
        weekStart: game.week,
        weekEnd: game.week,
        rosterStatus: 'active',
        transactionType: 'signed',
      };
      stints.push(prev);
      continue;
    }

    const sameTeam: boolean = prev.teamAbbr === game.teamAbbr;
    const contiguous: boolean = game.week === prev.weekEnd + 1;

    if (sameTeam && contiguous) {
      prev.weekEnd = game.week;
      continue;
    }

    const gapStart = prev.weekEnd + 1;
    const gapEnd = game.week - 1;
    if (sameTeam && gapStart <= gapEnd) {
      stints.push({
        teamAbbr: game.teamAbbr,
        weekStart: gapStart,
        weekEnd: gapEnd,
        rosterStatus: 'practice_squad',
        transactionType: 'demoted',
      });
    }

    prev = {
      teamAbbr: game.teamAbbr,
      weekStart: game.week,
      weekEnd: game.week,
      rosterStatus: 'active',
      transactionType: sameTeam ? 'promoted' : 'traded',
    };
    stints.push(prev);
  }

  return stints;
}

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

async function getDbClient(): Promise<Client> {
  const config = await getDatabaseConnectionConfig();
  return new Client(config);
}

export async function handler(event: ScheduledEvent): Promise<void> {
  console.log('syncPlayerData triggered', JSON.stringify(event));

  const db = await getDbClient();
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

        const derivedStints = deriveRosterStintsFromGames(sortedGames, team.abbreviation);

        // Wrap all writes for this player in a transaction for atomicity
        await db.query('BEGIN');
        try {
          // Replace stints for this player-season so reruns converge deterministically.
          await db.query(
            'DELETE FROM team_rosters WHERE player_id = $1 AND season = $2',
            [playerId, season],
          );

          for (const stint of derivedStints) {
            await db.query(
              `INSERT INTO team_rosters (player_id, team_abbr, season, week_start, week_end, roster_status, transaction_type)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (player_id, season, week_start) DO UPDATE SET
                 team_abbr = EXCLUDED.team_abbr,
                 week_end = GREATEST(team_rosters.week_end, EXCLUDED.week_end),
                 roster_status = EXCLUDED.roster_status,
                 transaction_type = EXCLUDED.transaction_type`,
              [
                playerId,
                stint.teamAbbr,
                season,
                stint.weekStart,
                stint.weekEnd,
                stint.rosterStatus,
                stint.transactionType,
              ],
            );
          }

          for (const game of gamesToWrite) {
            const gameTeam = game.teamAbbr || team.abbreviation || 'UNK';
            const parsed = parseGameStats(gamelog.names, Object.values(game.stats), {
              playerId,
              season,
              week: game.week,
              teamAbbr: gameTeam,
              eventId: game.eventId,
            });
            statsInserted += await upsertGameStats(db, parsed);
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
