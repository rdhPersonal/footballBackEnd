import type { Pool } from 'pg';

export interface ScoringConfigRow {
  id: number;
  name: string;
  description: string | null;
  passing_yard_pts: string;
  passing_td_pts: string;
  interception_pts: string;
  sack_pts: string;
  rushing_yard_pts: string;
  rushing_td_pts: string;
  receiving_yard_pts: string;
  receiving_td_pts: string;
  reception_pts: string;
  fumble_lost_pts: string;
  fg_made_pts: string;
  xp_made_pts: string;
}

export async function getScoringConfigs(pool: Pool): Promise<ScoringConfigRow[]> {
  const result = await pool.query(
    `SELECT id, name, description,
            passing_yard_pts, passing_td_pts, interception_pts, sack_pts,
            rushing_yard_pts, rushing_td_pts,
            receiving_yard_pts, receiving_td_pts, reception_pts,
            fumble_lost_pts, fg_made_pts, xp_made_pts
     FROM scoring_configs ORDER BY id`,
  );
  return result.rows;
}

export async function getScoringConfigByName(pool: Pool, name: string): Promise<ScoringConfigRow | null> {
  const result = await pool.query(
    `SELECT id, name, description,
            passing_yard_pts, passing_td_pts, interception_pts, sack_pts,
            rushing_yard_pts, rushing_td_pts,
            receiving_yard_pts, receiving_td_pts, reception_pts,
            fumble_lost_pts, fg_made_pts, xp_made_pts
     FROM scoring_configs WHERE LOWER(name) = LOWER($1)`,
    [name],
  );
  return result.rows[0] ?? null;
}

/**
 * Compute fantasy points for a player-season using SQL against the typed stat tables.
 * Returns one row per week with the computed score.
 */
export interface WeeklyScoreRow {
  season: number;
  week: number;
  team_abbr: string;
  points: string;
}

export async function getPlayerWeeklyScores(
  pool: Pool,
  params: { playerId: string; season: number; configId: number },
): Promise<WeeklyScoreRow[]> {
  const result = await pool.query(
    `WITH cfg AS (
       SELECT * FROM scoring_configs WHERE id = $3
     ),
     weekly AS (
       SELECT COALESCE(p.season, ru.season, rc.season, k.season) AS season,
              COALESCE(p.week, ru.week, rc.week, k.week) AS week,
              COALESCE(p.team_abbr, ru.team_abbr, rc.team_abbr, k.team_abbr) AS team_abbr,
              COALESCE(p.yards, 0) AS pass_yds,
              COALESCE(p.touchdowns, 0) AS pass_td,
              COALESCE(p.interceptions, 0) AS ints,
              COALESCE(p.sacks, 0) AS sacks,
              COALESCE(ru.yards, 0) AS rush_yds,
              COALESCE(ru.touchdowns, 0) AS rush_td,
              COALESCE(ru.fumbles_lost, 0) AS fum_lost,
              COALESCE(rc.yards, 0) AS rec_yds,
              COALESCE(rc.touchdowns, 0) AS rec_td,
              COALESCE(rc.receptions, 0) AS rec,
              COALESCE(k.fg_made, 0) AS fg,
              COALESCE(k.xp_made, 0) AS xp
       FROM (SELECT DISTINCT season, week FROM (
               SELECT season, week FROM passing_stats WHERE player_id = $1 AND season = $2
               UNION SELECT season, week FROM rushing_stats WHERE player_id = $1 AND season = $2
               UNION SELECT season, week FROM receiving_stats WHERE player_id = $1 AND season = $2
               UNION SELECT season, week FROM kicking_stats WHERE player_id = $1 AND season = $2
             ) all_weeks) w
       LEFT JOIN passing_stats p ON p.player_id = $1 AND p.season = w.season AND p.week = w.week
       LEFT JOIN rushing_stats ru ON ru.player_id = $1 AND ru.season = w.season AND ru.week = w.week
       LEFT JOIN receiving_stats rc ON rc.player_id = $1 AND rc.season = w.season AND rc.week = w.week
       LEFT JOIN kicking_stats k ON k.player_id = $1 AND k.season = w.season AND k.week = w.week
     )
     SELECT w.season, w.week, w.team_abbr,
            ROUND(
              w.pass_yds * cfg.passing_yard_pts
              + w.pass_td * cfg.passing_td_pts
              + w.ints * cfg.interception_pts
              + w.sacks * cfg.sack_pts
              + w.rush_yds * cfg.rushing_yard_pts
              + w.rush_td * cfg.rushing_td_pts
              + w.rec_yds * cfg.receiving_yard_pts
              + w.rec_td * cfg.receiving_td_pts
              + w.rec * cfg.reception_pts
              + w.fum_lost * cfg.fumble_lost_pts
              + w.fg * cfg.fg_made_pts
              + w.xp * cfg.xp_made_pts
            , 2) AS points
     FROM weekly w, cfg
     ORDER BY w.week ASC`,
    [params.playerId, params.season, params.configId],
  );
  return result.rows;
}
