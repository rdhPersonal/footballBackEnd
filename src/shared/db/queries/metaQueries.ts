import type { Pool } from 'pg';

export interface SeasonSummaryRow {
  season: number;
  player_count: number;
  min_week: number;
  max_week: number;
  passing_rows: number;
  rushing_rows: number;
  receiving_rows: number;
  kicking_rows: number;
}

export async function getSeasonsSummary(pool: Pool): Promise<SeasonSummaryRow[]> {
  const result = await pool.query(`
    WITH all_stats AS (
      SELECT player_id, season, week, 'passing' AS stat_type FROM passing_stats
      UNION ALL
      SELECT player_id, season, week, 'rushing' FROM rushing_stats
      UNION ALL
      SELECT player_id, season, week, 'receiving' FROM receiving_stats
      UNION ALL
      SELECT player_id, season, week, 'kicking' FROM kicking_stats
    ),
    season_agg AS (
      SELECT
        season,
        COUNT(DISTINCT player_id) AS player_count,
        MIN(week) AS min_week,
        MAX(week) AS max_week
      FROM all_stats
      GROUP BY season
    ),
    type_counts AS (
      SELECT
        season,
        stat_type,
        COUNT(*) AS cnt
      FROM all_stats
      GROUP BY season, stat_type
    )
    SELECT
      sa.season,
      sa.player_count,
      sa.min_week,
      sa.max_week,
      COALESCE((SELECT cnt FROM type_counts tc WHERE tc.season = sa.season AND tc.stat_type = 'passing'), 0) AS passing_rows,
      COALESCE((SELECT cnt FROM type_counts tc WHERE tc.season = sa.season AND tc.stat_type = 'rushing'), 0) AS rushing_rows,
      COALESCE((SELECT cnt FROM type_counts tc WHERE tc.season = sa.season AND tc.stat_type = 'receiving'), 0) AS receiving_rows,
      COALESCE((SELECT cnt FROM type_counts tc WHERE tc.season = sa.season AND tc.stat_type = 'kicking'), 0) AS kicking_rows
    FROM season_agg sa
    ORDER BY sa.season DESC
  `);
  return result.rows;
}
