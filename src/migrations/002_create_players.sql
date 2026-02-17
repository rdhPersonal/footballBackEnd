-- 002: NFL players (team-agnostic identity data only)

CREATE TABLE IF NOT EXISTS players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   VARCHAR(50)  NOT NULL UNIQUE,
  name          VARCHAR(150) NOT NULL,
  position      VARCHAR(5)   NOT NULL,  -- QB, RB, WR, TE, K, DEF
  photo_url     VARCHAR(500),
  date_of_birth DATE,
  college       VARCHAR(150),
  height_inches SMALLINT,
  weight_lbs    SMALLINT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_players_position ON players (position);
CREATE INDEX idx_players_name ON players (name);
