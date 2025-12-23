#!/usr/bin/env python3
"""
Main script to fetch Fantasy League data from ESPN and load into the Fantasy Football API.

Usage:
    python scripts/load_fantasy_data.py --league 423869642 --season 2025
    python scripts/load_fantasy_data.py --league 423869642 --teams
    python scripts/load_fantasy_data.py --league 423869642 --all
"""
import argparse
import logging
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.espn_fetchers.espn_fantasy_client import ESPNFantasyClient
from scripts.espn_fetchers.api_client import FantasyFootballAPIClient
from scripts.espn_fetchers.fantasy_league_fetcher import FantasyLeagueFetcher
from scripts.espn_fetchers.fantasy_teams_fetcher import FantasyTeamsFetcher
from scripts.espn_fetchers.fantasy_draft_fetcher import FantasyDraftFetcher
from scripts.espn_fetchers.fantasy_roster_fetcher import FantasyRosterFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('fantasy_data_load.log')
    ]
)

logger = logging.getLogger(__name__)


def load_env_credentials():
    """Load ESPN credentials from .env file."""
    env_file = project_root / '.env'
    credentials = {}
    
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    credentials[key.strip()] = value.strip()
    
    return credentials


def main():
    parser = argparse.ArgumentParser(
        description='Fetch Fantasy League data from ESPN and load into Fantasy Football API'
    )
    
    # API configuration
    parser.add_argument(
        '--api-url',
        default='https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev',
        help='Base URL of the Fantasy Football API'
    )
    
    # League configuration
    parser.add_argument(
        '--league',
        required=True,
        help='ESPN League ID (e.g., 423869642)'
    )
    parser.add_argument(
        '--season',
        type=int,
        default=2025,
        help='Fantasy season year'
    )
    
    # What to fetch
    parser.add_argument('--info', action='store_true', help='Fetch league info')
    parser.add_argument('--teams', action='store_true', help='Fetch fantasy teams')
    parser.add_argument('--draft', action='store_true', help='Fetch draft results')
    parser.add_argument('--rosters', action='store_true', help='Fetch current rosters')
    parser.add_argument('--transactions', action='store_true', help='Fetch transactions')
    parser.add_argument('--matchups', action='store_true', help='Fetch matchups')
    parser.add_argument('--all', action='store_true', help='Fetch all available data')
    
    # Authentication
    parser.add_argument('--espn-s2', help='ESPN S2 cookie for private leagues')
    parser.add_argument('--swid', help='ESPN SWID cookie for private leagues')
    
    # Logging
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    
    args = parser.parse_args()
    
    # Set log level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Load credentials from .env file
    logger.info("Loading ESPN credentials from .env file")
    credentials = load_env_credentials()
    
    espn_username = credentials.get('espn_ffl_user')
    espn_password = credentials.get('espn_ffl_pw')
    
    if not espn_username or not espn_password:
        logger.error("ESPN credentials not found in .env file")
        logger.error("Please ensure espn_ffl_user and espn_ffl_pw are set in .env")
        return 1
    
    logger.info(f"Using ESPN credentials for user: {espn_username}")
    
    # Initialize clients
    logger.info(f"Connecting to API: {args.api_url}")
    
    # Get cookies from args or .env
    espn_s2 = args.espn_s2 or credentials.get('espn_s2') or credentials.get('my_espn2')
    swid = args.swid or credentials.get('swid') or credentials.get('my_swid')
    
    espn_client = ESPNFantasyClient(
        username=espn_username,
        password=espn_password,
        espn_s2=espn_s2,
        swid=swid
    )
    api_client = FantasyFootballAPIClient(args.api_url)
    
    # Test league access
    logger.info(f"Testing access to league {args.league}")
    if not espn_client.test_league_access(args.league, args.season):
        logger.error(f"Cannot access league {args.league}")
        logger.error("This may be a private league requiring S2/SWID cookies")
        logger.error("Try logging into ESPN Fantasy in your browser and extracting cookies")
        return 1
    
    logger.info(f"Successfully connected to league {args.league}")
    
    # Determine what to fetch
    fetch_info = args.info or args.all
    fetch_teams = args.teams or args.all
    fetch_draft = args.draft or args.all
    fetch_rosters = args.rosters or args.all
    fetch_transactions = args.transactions or args.all
    fetch_matchups = args.matchups or args.all
    
    if not any([fetch_info, fetch_teams, fetch_draft, fetch_rosters, fetch_transactions, fetch_matchups]):
        parser.print_help()
        logger.error("No data type specified. Use --info, --teams, --all, etc.")
        return 1
    
    # Fetch data in order: info -> teams -> draft -> rosters -> transactions -> matchups
    try:
        if fetch_info:
            logger.info("=" * 60)
            logger.info("FETCHING LEAGUE INFO")
            logger.info("=" * 60)
            league_fetcher = FantasyLeagueFetcher(espn_client, api_client)
            result = league_fetcher.fetch_and_post(args.league, args.season)
            logger.info(f"League info result: {result}")
        
        if fetch_teams:
            logger.info("=" * 60)
            logger.info("FETCHING FANTASY TEAMS")
            logger.info("=" * 60)
            teams_fetcher = FantasyTeamsFetcher(espn_client, api_client)
            result = teams_fetcher.fetch_and_post(args.league, args.season)
            logger.info(f"Teams result: {result}")
        
        if fetch_draft:
            logger.info("=" * 60)
            logger.info("FETCHING DRAFT RESULTS")
            logger.info("=" * 60)
            draft_fetcher = FantasyDraftFetcher(espn_client, api_client)
            result = draft_fetcher.fetch_and_post(args.league, args.season)
            logger.info(f"Draft result: {result}")
        
        if fetch_rosters:
            logger.info("=" * 60)
            logger.info("FETCHING ROSTERS")
            logger.info("=" * 60)
            roster_fetcher = FantasyRosterFetcher(espn_client, api_client)
            result = roster_fetcher.fetch_and_post(args.league, args.season)
            logger.info(f"Roster result: {result}")
        
        if fetch_transactions:
            logger.info("=" * 60)
            logger.info("FETCHING TRANSACTIONS")
            logger.info("=" * 60)
            logger.info("Transaction fetcher not yet implemented")
        
        if fetch_matchups:
            logger.info("=" * 60)
            logger.info("FETCHING MATCHUPS")
            logger.info("=" * 60)
            logger.info("Matchup fetcher not yet implemented")
        
        logger.info("=" * 60)
        logger.info("FANTASY DATA LOAD COMPLETE")
        logger.info("=" * 60)
        return 0
    
    except Exception as e:
        logger.error(f"Fatal error during fantasy data load: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())