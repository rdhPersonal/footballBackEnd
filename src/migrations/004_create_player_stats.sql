-- 004: Weekly player statistics per season.
-- team_abbr is denormalized from team_rosters for query convenience.
-- stat_details JSONB holds position-specific stats (to be extended later).

CREATE TABLE IF NOT EXISTS player_stats (
  id               SERIAL      PRIMARY KEY,
  player_id        UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_abbr        VARCHAR(5)  NOT NULL,
  season           SMALLINT    NOT NULL,
  week             SMALLINT    NOT NULL,  -- 1-18 (0 = season totals)
  games_played     SMALLINT    NOT NULL DEFAULT 0,
  total_points     NUMERIC(8,2) NOT NULL DEFAULT 0,
  projected_points NUMERIC(8,2),
  stat_details     JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_player_stats_player_season_week UNIQUE (player_id, season, week)
);

CREATE INDEX idx_player_stats_player_season ON player_stats (player_id, season);
CREATE INDEX idx_player_stats_season_week ON player_stats (season, week);
CREATE INDEX idx_player_stats_team_season ON player_stats (team_abbr, season);
