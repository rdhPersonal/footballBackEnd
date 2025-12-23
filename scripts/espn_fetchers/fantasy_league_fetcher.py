"""
Fetcher for ESPN Fantasy League basic information.
"""
import logging
from typing import List, Dict, Any, Optional
from .espn_fantasy_client import ESPNFantasyClient
from .api_client import FantasyFootballAPIClient

logger = logging.getLogger(__name__)


class FantasyLeagueFetcher:
    """Fetches fantasy league info from ESPN and posts to API."""
    
    def __init__(self, espn_client: ESPNFantasyClient, api_client: FantasyFootballAPIClient):
        """Initialize the fetcher."""
        self.espn_client = espn_client
        self.api_client = api_client
    
    def transform_league_data(self, espn_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Transform ESPN league data to API format.
        
        Args:
            espn_data: League data from ESPN
        
        Returns:
            League data in API format, or None if transformation fails
        """
        try:
            settings = espn_data.get('settings', {})
            
            # Debug: Log the ESPN data structure
            logger.debug(f"ESPN league data keys: {list(espn_data.keys())}")
            logger.debug(f"Settings keys: {list(settings.keys()) if settings else 'No settings'}")
            
            # Get team count from settings.size instead of teams array
            num_teams = settings.get('size', 10)  # Default to 10 if not found
            
            # Get playoff settings
            schedule_settings = settings.get('scheduleSettings', {})
            playoff_start = schedule_settings.get('playoffWeekStart')
            championship_week = schedule_settings.get('playoffWeekEnd')
            
            league_data = {
                'name': settings.get('name', 'Unknown League'),
                'season': espn_data.get('seasonId', 2025),  # Use seasonId from root, not settings
                'espn_league_id': str(espn_data.get('id', '')),
                'num_teams': num_teams,
                'playoff_start_week': playoff_start,
                'championship_week': championship_week
            }
            
            logger.debug(f"Transformed league data: {league_data}")
            return league_data
        
        except Exception as e:
            logger.error(f"Failed to transform league data: {e}")
            return None
    
    def fetch_and_post(self, league_id: str, season: int = 2025) -> Dict[str, Any]:
        """
        Fetch fantasy league info from ESPN and post to API.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
        
        Returns:
            API response with insert/update counts
        """
        logger.info(f"Starting fantasy league fetch for league {league_id}, season {season}")
        
        try:
            # Test league access first
            if not self.espn_client.test_league_access(league_id, season):
                return {
                    "success": False,
                    "message": f"Cannot access league {league_id} - may be private or invalid"
                }
            
            # Fetch league info
            espn_data = self.espn_client.get_league_info(league_id, season)
            
            # Transform data
            league_data = self.transform_league_data(espn_data)
            
            if not league_data:
                return {
                    "success": False,
                    "message": "Failed to transform league data"
                }
            
            # Post to API
            result = self.api_client.post_fantasy_leagues([league_data])
            
            logger.info(f"Posted league data: {result}")
            return result
        
        except Exception as e:
            logger.error(f"Failed to fetch league data: {e}")
            return {
                "success": False,
                "message": f"Error fetching league data: {str(e)}"
            }