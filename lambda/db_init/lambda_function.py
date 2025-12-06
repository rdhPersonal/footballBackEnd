"""
Lambda function to initialize the database schema.
This runs once to create all tables in the RDS PostgreSQL database.
"""

import json
import psycopg2
import boto3
import os

def get_db_credentials():
    """Retrieve database credentials from Secrets Manager"""
    secret_name = os.environ['DB_SECRET_ARN']
    # AWS_REGION is automatically available in Lambda
    region = os.environ.get('AWS_REGION', 'us-east-1')
    
    client = boto3.client('secretsmanager', region_name=region)
    response = client.get_secret_value(SecretId=secret_name)
    
    return json.loads(response['SecretString'])

def lambda_handler(event, context):
    """Initialize database schema"""
    
    try:
        # Get database credentials
        db_creds = get_db_credentials()
        
        print(f"Connecting to database at {db_creds['host']}...")
        
        # Connect to database
        conn = psycopg2.connect(
            host=db_creds['host'],
            port=db_creds['port'],
            database=db_creds['dbname'],
            user=db_creds['username'],
            password=db_creds['password'],
            connect_timeout=10
        )
        
        print("Connected successfully!")
        
        # Read and execute schema
        schema_sql = get_schema_sql()
        
        cursor = conn.cursor()
        print("Executing schema...")
        cursor.execute(schema_sql)
        conn.commit()
        
        print("Schema executed successfully!")
        
        # Verify tables were created
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        table_list = [table[0] for table in tables]
        
        print(f"Created {len(tables)} tables: {', '.join(table_list)}")
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Database schema initialized successfully!',
                'tables_created': len(tables),
                'tables': table_list
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }

def get_schema_sql():
    """Return the complete database schema SQL"""
    return """
-- Fantasy Football Database Schema
-- PostgreSQL 14+
-- Single League, 2025 Season Focus

-- ============================================================================
-- NFL DATA TABLES
-- ============================================================================

-- NFL Teams (32 teams)
CREATE TABLE IF NOT EXISTS nfl_teams (
    id SERIAL PRIMARY KEY,
    team_code VARCHAR(3) UNIQUE NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    conference VARCHAR(3) NOT NULL CHECK (conference IN ('AFC', 'NFC')),
    division VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nfl_teams_code ON nfl_teams(team_code);

-- NFL Players
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(10) NOT NULL,
    nfl_team_id INTEGER REFERENCES nfl_teams(id),
    jersey_number INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
CREATE INDEX IF NOT EXISTS idx_players_nfl_team ON players(nfl_team_id);
CREATE INDEX IF NOT EXISTS idx_players_external_id ON players(external_id);

-- NFL Games (schedule and results)
CREATE TABLE IF NOT EXISTS nfl_games (
    id SERIAL PRIMARY KEY,
    season INTEGER NOT NULL DEFAULT 2025,
    week INTEGER NOT NULL,
    game_date TIMESTAMP NOT NULL,
    home_team_id INTEGER NOT NULL REFERENCES nfl_teams(id),
    away_team_id INTEGER NOT NULL REFERENCES nfl_teams(id),
    home_score INTEGER,
    away_score INTEGER,
    is_final BOOLEAN DEFAULT FALSE,
    game_type VARCHAR(20) DEFAULT 'regular',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season, week, home_team_id, away_team_id)
);

CREATE INDEX IF NOT EXISTS idx_nfl_games_week ON nfl_games(season, week);
CREATE INDEX IF NOT EXISTS idx_nfl_games_date ON nfl_games(game_date);

-- Player Game Statistics
CREATE TABLE IF NOT EXISTS player_game_stats (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    nfl_game_id INTEGER NOT NULL REFERENCES nfl_games(id),
    passing_attempts INTEGER DEFAULT 0,
    passing_completions INTEGER DEFAULT 0,
    passing_yards INTEGER DEFAULT 0,
    passing_touchdowns INTEGER DEFAULT 0,
    interceptions INTEGER DEFAULT 0,
    rushing_attempts INTEGER DEFAULT 0,
    rushing_yards INTEGER DEFAULT 0,
    rushing_touchdowns INTEGER DEFAULT 0,
    receptions INTEGER DEFAULT 0,
    receiving_yards INTEGER DEFAULT 0,
    receiving_touchdowns INTEGER DEFAULT 0,
    targets INTEGER DEFAULT 0,
    fumbles_lost INTEGER DEFAULT 0,
    two_point_conversions INTEGER DEFAULT 0,
    field_goals_made INTEGER DEFAULT 0,
    field_goals_attempted INTEGER DEFAULT 0,
    extra_points_made INTEGER DEFAULT 0,
    extra_points_attempted INTEGER DEFAULT 0,
    sacks DECIMAL(4,1) DEFAULT 0,
    interceptions_defense INTEGER DEFAULT 0,
    fumbles_recovered INTEGER DEFAULT 0,
    touchdowns_defense INTEGER DEFAULT 0,
    points_allowed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, nfl_game_id)
);

CREATE INDEX IF NOT EXISTS idx_player_game_stats_player ON player_game_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_game_stats_game ON player_game_stats(nfl_game_id);

-- ============================================================================
-- FANTASY LEAGUE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS league (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    season INTEGER NOT NULL DEFAULT 2025,
    espn_league_id VARCHAR(100),
    num_teams INTEGER NOT NULL,
    playoff_start_week INTEGER,
    championship_week INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fantasy_teams (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES league(id),
    team_name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(200) NOT NULL,
    espn_team_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fantasy_teams_league ON fantasy_teams(league_id);

CREATE TABLE IF NOT EXISTS draft_picks (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES league(id),
    fantasy_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    round INTEGER NOT NULL,
    pick_number INTEGER NOT NULL,
    pick_in_round INTEGER NOT NULL,
    draft_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, pick_number)
);

CREATE INDEX IF NOT EXISTS idx_draft_picks_team ON draft_picks(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_draft_picks_player ON draft_picks(player_id);

CREATE TABLE IF NOT EXISTS roster_entries (
    id SERIAL PRIMARY KEY,
    fantasy_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    acquired_date DATE NOT NULL,
    released_date DATE,
    acquisition_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roster_entries_team ON roster_entries(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_roster_entries_player ON roster_entries(player_id);
CREATE INDEX IF NOT EXISTS idx_roster_entries_dates ON roster_entries(acquired_date, released_date);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES league(id),
    transaction_type VARCHAR(20) NOT NULL,
    transaction_date TIMESTAMP NOT NULL,
    fantasy_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    related_transaction_id INTEGER REFERENCES transactions(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_team ON transactions(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

CREATE TABLE IF NOT EXISTS matchups (
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

CREATE INDEX IF NOT EXISTS idx_matchups_week ON matchups(season, week);

CREATE TABLE IF NOT EXISTS lineups (
    id SERIAL PRIMARY KEY,
    matchup_id INTEGER NOT NULL REFERENCES matchups(id),
    fantasy_team_id INTEGER NOT NULL REFERENCES fantasy_teams(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    lineup_slot VARCHAR(20) NOT NULL,
    is_starter BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lineups_matchup ON lineups(matchup_id);
CREATE INDEX IF NOT EXISTS idx_lineups_team ON lineups(fantasy_team_id);

CREATE TABLE IF NOT EXISTS player_fantasy_scores (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    nfl_game_id INTEGER NOT NULL REFERENCES nfl_games(id),
    fantasy_points DECIMAL(6,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id, nfl_game_id)
);

CREATE INDEX IF NOT EXISTS idx_fantasy_scores_player ON player_fantasy_scores(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_scores_game ON player_fantasy_scores(nfl_game_id);

-- ============================================================================
-- USER/AUTH TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    cognito_sub VARCHAR(255) UNIQUE,
    fantasy_team_id INTEGER REFERENCES fantasy_teams(id),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cognito_sub ON users(cognito_sub);

-- ============================================================================
-- SCRAPING METADATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scrape_jobs_type ON scrape_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_created ON scrape_jobs(created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_nfl_teams_updated_at ON nfl_teams;
CREATE TRIGGER update_nfl_teams_updated_at BEFORE UPDATE ON nfl_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nfl_games_updated_at ON nfl_games;
CREATE TRIGGER update_nfl_games_updated_at BEFORE UPDATE ON nfl_games FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_player_game_stats_updated_at ON player_game_stats;
CREATE TRIGGER update_player_game_stats_updated_at BEFORE UPDATE ON player_game_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_league_updated_at ON league;
CREATE TRIGGER update_league_updated_at BEFORE UPDATE ON league FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fantasy_teams_updated_at ON fantasy_teams;
CREATE TRIGGER update_fantasy_teams_updated_at BEFORE UPDATE ON fantasy_teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roster_entries_updated_at ON roster_entries;
CREATE TRIGGER update_roster_entries_updated_at BEFORE UPDATE ON roster_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_matchups_updated_at ON matchups;
CREATE TRIGGER update_matchups_updated_at BEFORE UPDATE ON matchups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lineups_updated_at ON lineups;
CREATE TRIGGER update_lineups_updated_at BEFORE UPDATE ON lineups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_player_fantasy_scores_updated_at ON player_fantasy_scores;
CREATE TRIGGER update_player_fantasy_scores_updated_at BEFORE UPDATE ON player_fantasy_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
"""
