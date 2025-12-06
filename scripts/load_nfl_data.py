#!/usr/bin/env python3
"""
Main script to fetch NFL data from ESPN and load into the Fantasy Football API.

Usage:
    python scripts/load_nfl_data.py --teams
    python scripts/load_nfl_data.py --players
    python scripts/load_nfl_data.py --games --season 2025 --weeks 1-5
    python scripts/load_nfl_data.py --all --season 2025
"""
import argparse
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.espn_fetchers.espn_client import ESPNClient
from scripts.espn_fetchers.api_client import FantasyFootballAPIClient
from scripts.espn_fetchers.nfl_teams_fetcher import NFLTeamsFetcher
from scripts.espn_fetchers.nfl_players_fetcher import NFLPlayersFetcher
from scripts.espn_fetchers.nfl_games_fetcher import NFLGamesFetcher
from scripts.espn_fetchers.nfl_stats_fetcher import NFLStatsFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('nfl_data_load.log')
    ]
)

logger = logging.getLogger(__name__)


def parse_weeks(weeks_str: str) -> list:
    """
    Parse weeks string into list of week numbers.
    
    Examples:
        "1" -> [1]
        "1-5" -> [1, 2, 3, 4, 5]
        "1,3,5" -> [1, 3, 5]
        "1-3,5,7-9" -> [1, 2, 3, 5, 7, 8, 9]
    """
    weeks = []
    parts = weeks_str.split(',')
    
    for part in parts:
        part = part.strip()
        if '-' in part:
            start, end = part.split('-')
            weeks.extend(range(int(start), int(end) + 1))
        else:
            weeks.append(int(part))
    
    return sorted(set(weeks))


def main():
    parser = argparse.ArgumentParser(
        description='Fetch NFL data from ESPN and load into Fantasy Football API'
    )
    
    # API configuration
    parser.add_argument(
        '--api-url',
        default='https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev',
        help='Base URL of the Fantasy Football API'
    )
    
    # What to fetch
    parser.add_argument('--teams', action='store_true', help='Fetch NFL teams')
    parser.add_argument('--players', action='store_true', help='Fetch NFL players')
    parser.add_argument('--games', action='store_true', help='Fetch NFL games')
    parser.add_argument('--stats', action='store_true', help='Fetch player stats')
    parser.add_argument('--all', action='store_true', help='Fetch all data (teams, players, games)')
    
    # Parameters
    parser.add_argument('--season', type=int, default=2025, help='NFL season year')
    parser.add_argument(
        '--weeks',
        type=str,
        help='Weeks to fetch (e.g., "1", "1-5", "1,3,5", "1-3,5,7-9")'
    )
    parser.add_argument(
        '--season-type',
        type=int,
        default=2,
        choices=[1, 2, 3],
        help='Season type: 1=preseason, 2=regular, 3=postseason'
    )
    
    # Logging
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    
    args = parser.parse_args()
    
    # Set log level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Parse weeks
    weeks = None
    if args.weeks:
        weeks = parse_weeks(args.weeks)
        logger.info(f"Will fetch weeks: {weeks}")
    
    # Initialize clients
    logger.info(f"Connecting to API: {args.api_url}")
    espn_client = ESPNClient()
    api_client = FantasyFootballAPIClient(args.api_url)
    
    # Determine what to fetch
    fetch_teams = args.teams or args.all
    fetch_players = args.players or args.all
    fetch_games = args.games or args.all
    fetch_stats = args.stats
    
    if not any([fetch_teams, fetch_players, fetch_games, fetch_stats]):
        parser.print_help()
        logger.error("No data type specified. Use --teams, --players, --games, --stats, or --all")
        return 1
    
    # Fetch data in order: teams -> players -> games -> stats
    try:
        if fetch_teams:
            logger.info("=" * 60)
            logger.info("FETCHING NFL TEAMS")
            logger.info("=" * 60)
            teams_fetcher = NFLTeamsFetcher(espn_client, api_client)
            result = teams_fetcher.fetch_and_post()
            logger.info(f"Teams result: {result}")
        
        if fetch_players:
            logger.info("=" * 60)
            logger.info("FETCHING NFL PLAYERS")
            logger.info("=" * 60)
            players_fetcher = NFLPlayersFetcher(espn_client, api_client)
            result = players_fetcher.fetch_and_post()
            logger.info(f"Players result: {result}")
        
        if fetch_games:
            logger.info("=" * 60)
            logger.info("FETCHING NFL GAMES")
            logger.info("=" * 60)
            games_fetcher = NFLGamesFetcher(espn_client, api_client)
            result = games_fetcher.fetch_and_post(
                season=args.season,
                weeks=weeks,
                season_type=args.season_type
            )
            logger.info(f"Games result: {result}")
        
        if fetch_stats:
            logger.info("=" * 60)
            logger.info("FETCHING PLAYER STATS")
            logger.info("=" * 60)
            stats_fetcher = NFLStatsFetcher(espn_client, api_client)
            result = stats_fetcher.fetch_and_post(
                season=args.season,
                weeks=weeks
            )
            logger.info(f"Stats result: {result}")
        
        logger.info("=" * 60)
        logger.info("DATA LOAD COMPLETE")
        logger.info("=" * 60)
        return 0
    
    except Exception as e:
        logger.error(f"Fatal error during data load: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
