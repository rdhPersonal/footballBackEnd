-- 006: Replace loosely-typed player_stats (JSONB) with strongly-typed per-category stat tables.
-- Each table is keyed by (player_id, season, week) and a player can have rows in multiple
-- categories for the same game (e.g. a QB who rushes gets both passing_stats and rushing_stats).

-- Drop the old loosely-typed stats table and its event_id migration
DROP TABLE IF EXISTS player_stats CASCADE;

-- Passing stats (QB primary, but any player who throws a pass)
CREATE TABLE passing_stats (
  id            SERIAL      PRIMARY KEY,
  player_id     UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season        SMALLINT    NOT NULL,
  week          SMALLINT    NOT NULL,
  team_abbr     VARCHAR(5)  NOT NULL,
  event_id      VARCHAR(50),
  attempts      SMALLINT    NOT NULL DEFAULT 0,
  completions   SMALLINT    NOT NULL DEFAULT 0,
  yards         INTEGER     NOT NULL DEFAULT 0,
  touchdowns    SMALLINT    NOT NULL DEFAULT 0,
  interceptions SMALLINT    NOT NULL DEFAULT 0,
  sacks         SMALLINT    NOT NULL DEFAULT 0,
  longest       SMALLINT    NOT NULL DEFAULT 0,
  qb_rating     NUMERIC(5,1),
  adj_qbr       NUMERIC(5,1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_passing_stats UNIQUE (player_id, season, week)
);

CREATE INDEX idx_passing_season_week ON passing_stats (season, week);
CREATE INDEX idx_passing_team ON passing_stats (team_abbr, season);

-- Rushing stats (RB primary, but QB/WR/TE can rush)
CREATE TABLE rushing_stats (
  id            SERIAL      PRIMARY KEY,
  player_id     UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season        SMALLINT    NOT NULL,
  week          SMALLINT    NOT NULL,
  team_abbr     VARCHAR(5)  NOT NULL,
  event_id      VARCHAR(50),
  attempts      SMALLINT    NOT NULL DEFAULT 0,
  yards         INTEGER     NOT NULL DEFAULT 0,
  touchdowns    SMALLINT    NOT NULL DEFAULT 0,
  longest       SMALLINT    NOT NULL DEFAULT 0,
  fumbles       SMALLINT    NOT NULL DEFAULT 0,
  fumbles_lost  SMALLINT    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rushing_stats UNIQUE (player_id, season, week)
);

CREATE INDEX idx_rushing_season_week ON rushing_stats (season, week);
CREATE INDEX idx_rushing_team ON rushing_stats (team_abbr, season);

-- Receiving stats (WR/TE/RB primary)
CREATE TABLE receiving_stats (
  id            SERIAL      PRIMARY KEY,
  player_id     UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season        SMALLINT    NOT NULL,
  week          SMALLINT    NOT NULL,
  team_abbr     VARCHAR(5)  NOT NULL,
  event_id      VARCHAR(50),
  targets       SMALLINT    NOT NULL DEFAULT 0,
  receptions    SMALLINT    NOT NULL DEFAULT 0,
  yards         INTEGER     NOT NULL DEFAULT 0,
  touchdowns    SMALLINT    NOT NULL DEFAULT 0,
  longest       SMALLINT    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_receiving_stats UNIQUE (player_id, season, week)
);

CREATE INDEX idx_receiving_season_week ON receiving_stats (season, week);
CREATE INDEX idx_receiving_team ON receiving_stats (team_abbr, season);

-- Kicking stats (placekickers only — FG and XP)
CREATE TABLE kicking_stats (
  id            SERIAL      PRIMARY KEY,
  player_id     UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season        SMALLINT    NOT NULL,
  week          SMALLINT    NOT NULL,
  team_abbr     VARCHAR(5)  NOT NULL,
  event_id      VARCHAR(50),
  fg_made       SMALLINT    NOT NULL DEFAULT 0,
  fg_attempted  SMALLINT    NOT NULL DEFAULT 0,
  fg_long       SMALLINT    NOT NULL DEFAULT 0,
  fg_pct        NUMERIC(5,1),
  xp_made       SMALLINT    NOT NULL DEFAULT 0,
  xp_attempted  SMALLINT    NOT NULL DEFAULT 0,
  points        SMALLINT    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_kicking_stats UNIQUE (player_id, season, week)
);

CREATE INDEX idx_kicking_season_week ON kicking_stats (season, week);
CREATE INDEX idx_kicking_team ON kicking_stats (team_abbr, season);
