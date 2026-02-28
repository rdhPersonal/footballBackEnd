-- 001: NFL teams reference data (one row per team per season)

CREATE TABLE IF NOT EXISTS nfl_teams (
  id         SERIAL PRIMARY KEY,
  abbr       VARCHAR(5)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  conference VARCHAR(3)  NOT NULL,  -- AFC, NFC
  division   VARCHAR(10) NOT NULL,  -- North, South, East, West
  bye_week   SMALLINT,
  season     SMALLINT    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_nfl_teams_abbr_season UNIQUE (abbr, season)
);

CREATE INDEX IF NOT EXISTS idx_nfl_teams_season ON nfl_teams (season);
