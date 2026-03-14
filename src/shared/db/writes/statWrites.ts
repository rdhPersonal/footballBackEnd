import type { Client, Pool } from 'pg';
import type { PlayerGameStats } from '../../types/player';

type DbConn = Client | Pool;

export async function upsertPassingStats(db: DbConn, s: NonNullable<PlayerGameStats['passing']>): Promise<void> {
  await db.query(
    `INSERT INTO passing_stats
       (player_id, season, week, team_abbr, event_id, attempts, completions, yards, touchdowns, interceptions, sacks, longest, qb_rating, adj_qbr)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (player_id, season, week) DO UPDATE SET
       team_abbr = EXCLUDED.team_abbr,
       event_id = EXCLUDED.event_id,
       attempts = EXCLUDED.attempts,
       completions = EXCLUDED.completions,
       yards = EXCLUDED.yards,
       touchdowns = EXCLUDED.touchdowns,
       interceptions = EXCLUDED.interceptions,
       sacks = EXCLUDED.sacks,
       longest = EXCLUDED.longest,
       qb_rating = EXCLUDED.qb_rating,
       adj_qbr = EXCLUDED.adj_qbr,
       updated_at = NOW()`,
    [
      s.playerId, s.season, s.week, s.teamAbbr, s.eventId ?? null,
      s.attempts, s.completions, s.yards, s.touchdowns, s.interceptions,
      s.sacks, s.longest, s.qbRating ?? null, s.adjQbr ?? null,
    ],
  );
}

export async function upsertRushingStats(db: DbConn, s: NonNullable<PlayerGameStats['rushing']>): Promise<void> {
  await db.query(
    `INSERT INTO rushing_stats
       (player_id, season, week, team_abbr, event_id, attempts, yards, touchdowns, longest, fumbles, fumbles_lost)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (player_id, season, week) DO UPDATE SET
       team_abbr = EXCLUDED.team_abbr,
       event_id = EXCLUDED.event_id,
       attempts = EXCLUDED.attempts,
       yards = EXCLUDED.yards,
       touchdowns = EXCLUDED.touchdowns,
       longest = EXCLUDED.longest,
       fumbles = EXCLUDED.fumbles,
       fumbles_lost = EXCLUDED.fumbles_lost,
       updated_at = NOW()`,
    [
      s.playerId, s.season, s.week, s.teamAbbr, s.eventId ?? null,
      s.attempts, s.yards, s.touchdowns, s.longest, s.fumbles, s.fumblesLost,
    ],
  );
}

export async function upsertReceivingStats(db: DbConn, s: NonNullable<PlayerGameStats['receiving']>): Promise<void> {
  await db.query(
    `INSERT INTO receiving_stats
       (player_id, season, week, team_abbr, event_id, targets, receptions, yards, touchdowns, longest)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (player_id, season, week) DO UPDATE SET
       team_abbr = EXCLUDED.team_abbr,
       event_id = EXCLUDED.event_id,
       targets = EXCLUDED.targets,
       receptions = EXCLUDED.receptions,
       yards = EXCLUDED.yards,
       touchdowns = EXCLUDED.touchdowns,
       longest = EXCLUDED.longest,
       updated_at = NOW()`,
    [
      s.playerId, s.season, s.week, s.teamAbbr, s.eventId ?? null,
      s.targets, s.receptions, s.yards, s.touchdowns, s.longest,
    ],
  );
}

export async function upsertKickingStats(db: DbConn, s: NonNullable<PlayerGameStats['kicking']>): Promise<void> {
  await db.query(
    `INSERT INTO kicking_stats
       (player_id, season, week, team_abbr, event_id, fg_made, fg_attempted, fg_long, fg_pct, xp_made, xp_attempted, points)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (player_id, season, week) DO UPDATE SET
       team_abbr = EXCLUDED.team_abbr,
       event_id = EXCLUDED.event_id,
       fg_made = EXCLUDED.fg_made,
       fg_attempted = EXCLUDED.fg_attempted,
       fg_long = EXCLUDED.fg_long,
       fg_pct = EXCLUDED.fg_pct,
       xp_made = EXCLUDED.xp_made,
       xp_attempted = EXCLUDED.xp_attempted,
       points = EXCLUDED.points,
       updated_at = NOW()`,
    [
      s.playerId, s.season, s.week, s.teamAbbr, s.eventId ?? null,
      s.fgMade, s.fgAttempted, s.fgLong, s.fgPct ?? null,
      s.xpMade, s.xpAttempted, s.points,
    ],
  );
}

export async function upsertGameStats(db: DbConn, stats: PlayerGameStats): Promise<number> {
  let count = 0;
  if (stats.passing) { await upsertPassingStats(db, stats.passing); count++; }
  if (stats.rushing) { await upsertRushingStats(db, stats.rushing); count++; }
  if (stats.receiving) { await upsertReceivingStats(db, stats.receiving); count++; }
  if (stats.kicking) { await upsertKickingStats(db, stats.kicking); count++; }
  return count;
}
