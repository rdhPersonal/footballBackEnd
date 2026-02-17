import type { Pool } from 'pg';

export interface PlayerStatRow {
  id: number;
  player_id: string;
  team_abbr: string;
  season: number;
  week: number;
  games_played: number;
  total_points: number;
  projected_points: number | null;
  stat_details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface StatsParams {
  playerId: string;
  season?: number;
  week?: number;
}

export async function getPlayerStats(
  pool: Pool,
  params: StatsParams,
): Promise<PlayerStatRow[]> {
  const conditions: string[] = ['ps.player_id = $1'];
  const values: unknown[] = [params.playerId];
  let paramIndex = 2;

  if (params.season) {
    conditions.push(`ps.season = $${paramIndex++}`);
    values.push(params.season);
  }

  if (params.week) {
    conditions.push(`ps.week = $${paramIndex++}`);
    values.push(params.week);
  }

  const sql = `
    SELECT ps.*
    FROM player_stats ps
    WHERE ${conditions.join(' AND ')}
    ORDER BY ps.season DESC, ps.week ASC
  `;

  const result = await pool.query(sql, values);
  return result.rows;
}
