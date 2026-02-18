import type { Pool } from 'pg';

export interface PlayerRow {
  id: string;
  external_id: string;
  name: string;
  position: string;
  photo_url: string | null;
  date_of_birth: string | null;
  college: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerWithCurrentTeam extends PlayerRow {
  current_team_abbr: string | null;
  roster_status: string | null;
}

interface SearchParams {
  position?: string;
  team?: string;
  season?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function searchPlayers(
  pool: Pool,
  params: SearchParams,
): Promise<PlayerRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.position) {
    conditions.push(`p.position = $${paramIndex++}`);
    values.push(params.position.toUpperCase());
  }

  if (params.search) {
    conditions.push(`p.name ILIKE $${paramIndex++}`);
    values.push(`%${params.search}%`);
  }

  if (params.team && params.season) {
    conditions.push(`EXISTS (
      SELECT 1 FROM team_rosters tr
      WHERE tr.player_id = p.id
        AND tr.team_abbr = $${paramIndex++}
        AND tr.season = $${paramIndex++}
    )`);
    values.push(params.team.toUpperCase(), params.season);
  } else if (params.team) {
    conditions.push(`EXISTS (
      SELECT 1 FROM team_rosters tr
      WHERE tr.player_id = p.id
        AND tr.team_abbr = $${paramIndex++}
    )`);
    values.push(params.team.toUpperCase());
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(params.limit || 50, 200);
  const offset = params.offset || 0;

  const sql = `
    SELECT p.*
    FROM players p
    ${where}
    ORDER BY p.name ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  values.push(limit, offset);

  const result = await pool.query(sql, values);
  return result.rows;
}

export async function getPlayerById(
  pool: Pool,
  id: string,
): Promise<PlayerWithCurrentTeam | null> {
  const sql = `
    SELECT p.*,
      latest_roster.team_abbr AS current_team_abbr,
      latest_roster.roster_status
    FROM players p
    LEFT JOIN LATERAL (
      SELECT tr.team_abbr, tr.roster_status
      FROM team_rosters tr
      WHERE tr.player_id = p.id
      ORDER BY tr.season DESC, tr.week_start DESC, tr.id DESC
      LIMIT 1
    ) latest_roster ON true
    WHERE p.id = $1
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}
