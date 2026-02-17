import type { Pool } from 'pg';

export interface RosterStintRow {
  id: number;
  player_id: string;
  team_abbr: string;
  season: number;
  week_start: number;
  week_end: number | null;
  roster_status: string;
  transaction_type: string;
  created_at: string;
}

export async function getPlayerRosterHistory(
  pool: Pool,
  playerId: string,
): Promise<RosterStintRow[]> {
  const sql = `
    SELECT *
    FROM team_rosters
    WHERE player_id = $1
    ORDER BY season DESC, week_start DESC
  `;

  const result = await pool.query(sql, [playerId]);
  return result.rows;
}
