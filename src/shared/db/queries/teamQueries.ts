import type { Pool } from 'pg';

export interface TeamRow {
  id: number;
  abbr: string;
  name: string;
  conference: string;
  division: string;
  bye_week: number | null;
  season: number;
}

interface GetTeamsParams {
  season?: number;
}

export async function getTeams(
  pool: Pool,
  params: GetTeamsParams = {},
): Promise<TeamRow[]> {
  if (params.season) {
    const result = await pool.query(
      `SELECT id, abbr, name, conference, division, bye_week, season
       FROM nfl_teams
       WHERE season = $1
       ORDER BY conference, division, name`,
      [params.season],
    );
    return result.rows;
  }

  // DISTINCT ON must order by the distinct column first to pick the latest season per team.
  // Wrap in a subquery so the outer ORDER BY can sort by conference/division/name consistently
  // with the season-filter path.
  const result = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (abbr) id, abbr, name, conference, division, bye_week, season
       FROM nfl_teams
       ORDER BY abbr, season DESC
     ) t
     ORDER BY conference, division, name`,
  );
  return result.rows;
}
