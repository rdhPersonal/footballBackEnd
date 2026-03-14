-- 007: Scoring configurations for fantasy football leagues.
-- Each config defines point values per stat category. Multiple configs
-- support different league formats (Standard, PPR, Half-PPR, etc.)

CREATE TABLE scoring_configs (
  id                     SERIAL      PRIMARY KEY,
  name                   VARCHAR(100) NOT NULL UNIQUE,
  description            TEXT,

  -- Passing
  passing_yard_pts       NUMERIC(6,3) NOT NULL DEFAULT 0.04,   -- 1 pt per 25 yds
  passing_td_pts         NUMERIC(6,3) NOT NULL DEFAULT 4,
  interception_pts       NUMERIC(6,3) NOT NULL DEFAULT -2,
  sack_pts               NUMERIC(6,3) NOT NULL DEFAULT 0,

  -- Rushing
  rushing_yard_pts       NUMERIC(6,3) NOT NULL DEFAULT 0.1,    -- 1 pt per 10 yds
  rushing_td_pts         NUMERIC(6,3) NOT NULL DEFAULT 6,

  -- Receiving
  receiving_yard_pts     NUMERIC(6,3) NOT NULL DEFAULT 0.1,    -- 1 pt per 10 yds
  receiving_td_pts       NUMERIC(6,3) NOT NULL DEFAULT 6,
  reception_pts          NUMERIC(6,3) NOT NULL DEFAULT 0,      -- 0=standard, 0.5=half, 1=PPR

  -- Fumbles
  fumble_lost_pts        NUMERIC(6,3) NOT NULL DEFAULT -2,

  -- Kicking
  fg_made_pts            NUMERIC(6,3) NOT NULL DEFAULT 3,
  xp_made_pts            NUMERIC(6,3) NOT NULL DEFAULT 1,

  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed the three common scoring formats
INSERT INTO scoring_configs (name, description, reception_pts) VALUES
  ('Standard', 'Standard scoring — no points per reception', 0),
  ('Half-PPR', 'Half point per reception', 0.5),
  ('PPR', 'Full point per reception', 1);
