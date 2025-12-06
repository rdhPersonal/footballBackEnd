"""
Configuration for the Fantasy Football application.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Database Configuration
DB_HOST = os.getenv('DB_HOST', 'fantasy-football-dev-db.cpapglostuzx.us-east-1.rds.amazonaws.com')
DB_PORT = int(os.getenv('DB_PORT', '5432'))
DB_NAME = os.getenv('DB_NAME', 'fantasy_football')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

# ESPN API Configuration
ESPN_API_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

# NFL Season Configuration
CURRENT_SEASON = 2025
NFL_REGULAR_SEASON_WEEKS = 18
NFL_TEAM_COUNT = 32

# Logging Configuration
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
