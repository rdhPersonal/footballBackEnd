-- 003: Team rosters — associates players with teams during a season with week granularity.
-- A player can have multiple stints on the same or different teams in a season.
-- A gap between stints means the player was a free agent.

CREATE TABLE IF NOT EXISTS team_rosters (
  id               SERIAL      PRIMARY KEY,
  player_id        UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_abbr        VARCHAR(5)  NOT NULL,
  season           SMALLINT    NOT NULL,
  week_start       SMALLINT    NOT NULL,  -- first week of this stint (1-18)
  week_end         SMALLINT,              -- last week of this stint (NULL = active through end of season)
  roster_status    VARCHAR(20) NOT NULL,  -- active, practice_squad, injured_reserve, suspended, pup
  transaction_type VARCHAR(20) NOT NULL,  -- drafted, signed, traded, claimed, promoted, demoted, activated, released
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_team_rosters_player_season_week UNIQUE (player_id, season, week_start)
);

CREATE INDEX IF NOT EXISTS idx_team_rosters_player_season ON team_rosters (player_id, season);
CREATE INDEX IF NOT EXISTS idx_team_rosters_team_season ON team_rosters (team_abbr, season);
CREATE INDEX IF NOT EXISTS idx_team_rosters_transaction ON team_rosters (season, transaction_type);
CREATE INDEX IF NOT EXISTS idx_team_rosters_status ON team_rosters (roster_status, season);
