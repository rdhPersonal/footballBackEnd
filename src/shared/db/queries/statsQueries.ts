import type { Pool } from 'pg';

interface StatsParams {
  playerId: string;
  season?: number;
  week?: number;
}

export interface PassingStatRow {
  player_id: string;
  season: number;
  week: number;
  team_abbr: string;
  event_id: string | null;
  attempts: number;
  completions: number;
  yards: number;
  touchdowns: number;
  interceptions: number;
  sacks: number;
  longest: number;
  qb_rating: string | null;
  adj_qbr: string | null;
}

export interface RushingStatRow {
  player_id: string;
  season: number;
  week: number;
  team_abbr: string;
  event_id: string | null;
  attempts: number;
  yards: number;
  touchdowns: number;
  longest: number;
  fumbles: number;
  fumbles_lost: number;
}

export interface ReceivingStatRow {
  player_id: string;
  season: number;
  week: number;
  team_abbr: string;
  event_id: string | null;
  targets: number;
  receptions: number;
  yards: number;
  touchdowns: number;
  longest: number;
}

export interface KickingStatRow {
  player_id: string;
  season: number;
  week: number;
  team_abbr: string;
  event_id: string | null;
  fg_made: number;
  fg_attempted: number;
  fg_long: number;
  fg_pct: string | null;
  xp_made: number;
  xp_attempted: number;
  points: number;
}

function buildWhereClause(alias: string, params: StatsParams): { where: string; values: unknown[] } {
  const conditions: string[] = [`${alias}.player_id = $1`];
  const values: unknown[] = [params.playerId];
  let idx = 2;

  if (params.season) {
    conditions.push(`${alias}.season = $${idx++}`);
    values.push(params.season);
  }
  if (params.week) {
    conditions.push(`${alias}.week = $${idx++}`);
    values.push(params.week);
  }

  return { where: conditions.join(' AND '), values };
}

export async function getPassingStats(pool: Pool, params: StatsParams): Promise<PassingStatRow[]> {
  const { where, values } = buildWhereClause('s', params);
  const result = await pool.query(
    `SELECT s.player_id, s.season, s.week, s.team_abbr, s.event_id,
            s.attempts, s.completions, s.yards, s.touchdowns, s.interceptions,
            s.sacks, s.longest, s.qb_rating, s.adj_qbr
     FROM passing_stats s WHERE ${where} ORDER BY s.season DESC, s.week ASC`,
    values,
  );
  return result.rows;
}

export async function getRushingStats(pool: Pool, params: StatsParams): Promise<RushingStatRow[]> {
  const { where, values } = buildWhereClause('s', params);
  const result = await pool.query(
    `SELECT s.player_id, s.season, s.week, s.team_abbr, s.event_id,
            s.attempts, s.yards, s.touchdowns, s.longest, s.fumbles, s.fumbles_lost
     FROM rushing_stats s WHERE ${where} ORDER BY s.season DESC, s.week ASC`,
    values,
  );
  return result.rows;
}

export async function getReceivingStats(pool: Pool, params: StatsParams): Promise<ReceivingStatRow[]> {
  const { where, values } = buildWhereClause('s', params);
  const result = await pool.query(
    `SELECT s.player_id, s.season, s.week, s.team_abbr, s.event_id,
            s.targets, s.receptions, s.yards, s.touchdowns, s.longest
     FROM receiving_stats s WHERE ${where} ORDER BY s.season DESC, s.week ASC`,
    values,
  );
  return result.rows;
}

export async function getKickingStats(pool: Pool, params: StatsParams): Promise<KickingStatRow[]> {
  const { where, values } = buildWhereClause('s', params);
  const result = await pool.query(
    `SELECT s.player_id, s.season, s.week, s.team_abbr, s.event_id,
            s.fg_made, s.fg_attempted, s.fg_long, s.fg_pct,
            s.xp_made, s.xp_attempted, s.points
     FROM kicking_stats s WHERE ${where} ORDER BY s.season DESC, s.week ASC`,
    values,
  );
  return result.rows;
}
