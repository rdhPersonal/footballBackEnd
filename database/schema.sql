-- Fantasy Football Database Schema
-- PostgreSQL 14+
-- Single League, 2025 Season Focus

-- ============================================================================
-- NFL DATA TABLES
-- ============================================================================

-- NFL Teams (32 teams)
CREATE TABLE nfl_teams (
    id SERIAL PRIMARY KEY,
    team_code VARCHAR(3) UNIQUE NOT NULL, -- e.g., 'KC', 'SF', 'BUF'
    team_name VARCHAR(100) NOT NULL, -- e.g., 'Kansas City Chiefs'
    city VARCHAR(100) NOT NULL,
    conference VARCHAR(3) NOT NULL CHECK (conference IN ('AFC', 'NFC')),
    division VARCHAR(10) NOT NULL, -- e.g., 'West', 'East', 'North', 'South'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NFL Players
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(50), -- ESPN/CBS player ID for matching
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(10) NOT NULL, -- QB, RB, WR, TE, K, DEF
    nfl_team_id INTEGER REFERENCES nfl_teams(id),
    jersey_number INTEGER,
    status VARCHAR(20) DEFAULT 'active', -- active, injured, suspended, retired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_nfl_team ON players(nfl_team_id);
CREATE INDEX idx_players_external_id ON players(external_id);

-- NFL Games (schedule and results)
CREATE TABLE nfl_games (
    id SERIAL PRIMARY KEY,
    season INTEGER NOT NULL DEFAULT 2025,
    week INTEGER NOT NULL, -- 1-18 regular season, 19+ playoffs
    game_date TIMESTAMP NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES nfl_teams(id),
    away_team_id INTEGER NOT NULL REFERENCES nfl_teams(id),
    home_score INTEGER,
    away_score INTEGER,
    is_final BOOLEAN DEFAULT FALSE,
    game_type VARCHAR(20) DEFAULT 'regular', -- regular, playoff, championship
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season, week, home_team_id, away_team_id)
);

CREATE INDEX idx_nfl_games_week ON nfl_games(season, week);
CREATE INDEX idx_nfl_games_date ON nfl_games(game_date);

-- Player Game Statistics (game-by-game performance)
CREATE TABLE player_game_stats (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    nfl_game_id INTEGER NOT NULL REFERENCES nfl_games(id),
    
    -- Passing stats
    passing_attempts INTEGER DEFAULT 0,
    passing_completions INTEGER DEFAULT 0,
    passing_yards INTEGER DEFAULT 0,
    passing_touchdowns INTEGER DEFAULT 0,
    interceptions INTEGER DEFAULT 0,
    
    -- Rushing stats
    rushing_attempts INTEGER DEFAULT 0,
    rushing_yards INTEGER DEFAULT 0,
    rushing_touchdowns INTEGER DEFAULT 0,
    
    -- Receiving stats
    receptions INTEGER DEFAULT 0,
    receiving_yards INTEGER DEFAULT 0,
    receiving_touchdowns INTEGER DEFAULT 0,
    targets INTEGER DEFAULT 0,
    
    -- Other stats
    fumbles_lost INTEGER DEFAULT 0,
    two_point_conversions INTEGER DEFAULT 0,
    
    -- Kicker stats
    field_goals_made INTEGER DEFAULT 0,
    field_goals_attempted INTEGER DEFAULT 0,
    extra_points_made INTEGER DEFAULT 0,
    extra_points_attempted INTEGER DEFAULT 0,
    
    -- Defense stats (if tracking team defense)
    sacks DECIMAL(4,1) DEFAULT 0,
    interceptions_defense INTEGER DEFAULT 0,
    fumbles_recovered INTEGER DEFAULT 0,
    touchdowns_defense INTEGER DEFAULT 0,
    points_allowed INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, nfl_game_id)
);

CREATE INDEX idx_player_game_stats_player ON player_game_stats(player_id);
CREATE INDEX idx_player_game_stats_game ON player_game_stats(nfl_game_id);

-- ============================================================================
-- FANTASY LEAGUE TABLES
-- ============================================================================

-- League Configuration (single league for now)
CREATE TABLE league (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    season INTEGER NOT NULL DEFAULT 2025,
    espn_league_id VARCHAR(100), -- ESPN league identifier
    num_teams INTEGER NOT NULL,
    playoff_start_week INTEGER,
    championship_week INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fantasy Teams in the league
CREATE TABLE fantasy_teams (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES league(id),
    team_name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(200) NOT NULL,
    espn_team_id VARCHAR(100), -- ESPN team identifier
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fantasy_teams_league ON fantasy_teams(league_id);

-- Draft Picks (complete draft history)
CREATE TABLE draft_picks (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES league(id),
    fantasy_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    round INTEGER NOT NULL,
    pick_number INTEGER NOT NULL, -- overall pick number
    pick_in_round INTEGER NOT NULL, -- pick within the round
    draft_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, pick_number)
);

CREATE INDEX idx_draft_picks_team ON draft_picks(fantasy_team_id);
CREATE INDEX idx_draft_picks_player ON draft_picks(player_id);

-- Roster History (tracks roster changes over time)
CREATE TABLE roster_entries (
    id SERIAL PRIMARY KEY,
    fantasy_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    acquired_date DATE NOT NULL,
    released_date DATE, -- NULL if still on roster
    acquisition_type VARCHAR(20), -- draft, waiver, trade, free_agent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roster_entries_team ON roster_entries(fantasy_team_id);
CREATE INDEX idx_roster_entries_player ON roster_entries(player_id);
CREATE INDEX idx_roster_entries_dates ON roster_entries(acquired_date, released_date);

-- Transactions (pickups, drops, trades)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES league(id),
    transaction_type VARCHAR(20) NOT NULL, -- pickup, drop, trade
    transaction_date TIMESTAMP NOT NULL,
    fantasy_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    related_transaction_id INTEGER REFERENCES transactions(id), -- for linking pickup/drop pairs
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_team ON transactions(fantasy_team_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);

-- Weekly Matchups (head-to-head games)
CREATE TABLE matchups (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES league(id),
    season INTEGER NOT NULL DEFAULT 2025,
    week INTEGER NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    away_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    home_score DECIMAL(6,2),
    away_score DECIMAL(6,2),
    is_playoff BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, season, week, home_team_id)
);

CREATE INDEX idx_matchups_week ON matchups(season, week);

-- Weekly Lineup Decisions (who started vs benched)
CREATE TABLE lineups (
    id SERIAL PRIMARY KEY,
    matchup_id INTEGER NOT NULL REFERENCES matchups(id),
    fantasy_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    lineup_slot VARCHAR(20) NOT NULL, -- QB, RB1, RB2, WR1, WR2, WR3, TE, FLEX, K, DEF, BENCH
    is_starter BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lineups_matchup ON lineups(matchup_id);
CREATE INDEX idx_lineups_team ON lineups(fantasy_team_id);

-- Player Fantasy Scores (calculated fantasy points per game)
CREATE TABLE player_fantasy_scores (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    nfl_game_id INTEGER NOT NULL REFERENCES nfl_games(id),
    fantasy_points DECIMAL(6,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, nfl_game_id)
);

CREATE INDEX idx_fantasy_scores_player ON player_fantasy_scores(player_id);
CREATE INDEX idx_fantasy_scores_game ON player_fantasy_scores(nfl_game_id);

-- ============================================================================
-- USER/AUTH TABLES
-- ============================================================================

-- Application Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- if using local auth
    cognito_sub VARCHAR(255) UNIQUE, -- if using AWS Cognito
    fantasy_team_id INTEGER REFERENCES fantasy_teams(id), -- link user to their team
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cognito_sub ON users(cognito_sub);

-- ============================================================================
-- SCRAPING METADATA (track scraping jobs)
-- ============================================================================

CREATE TABLE scrape_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- espn_league, espn_roster, espn_scores, espn_stats, etc.
    status VARCHAR(20) NOT NULL, -- pending, running, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB, -- flexible field for job-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scrape_jobs_type ON scrape_jobs(job_type);
CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_created ON scrape_jobs(created_at);

-- ============================================================================
-- TRIGGERS FOR updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_nfl_teams_updated_at BEFORE UPDATE ON nfl_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nfl_games_updated_at BEFORE UPDATE ON nfl_games FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_game_stats_updated_at BEFORE UPDATE ON player_game_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_league_updated_at BEFORE UPDATE ON league FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fantasy_teams_updated_at BEFORE UPDATE ON fantasy_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roster_entries_updated_at BEFORE UPDATE ON roster_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matchups_updated_at BEFORE UPDATE ON matchups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lineups_updated_at BEFORE UPDATE ON lineups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_player_fantasy_scores_updated_at BEFORE UPDATE ON player_fantasy_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
