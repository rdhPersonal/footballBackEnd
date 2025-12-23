"""
Fetcher for ESPN Fantasy League teams.
"""
import logging
from typing import List, Dict, Any, Optional
from .espn_fantasy_client import ESPNFantasyClient
from .api_client import FantasyFootballAPIClient

logger = logging.getLogger(__name__)


class FantasyTeamsFetcher:
    """Fetches fantasy teams from ESPN and posts to API."""
    
    def __init__(self, espn_client: ESPNFantasyClient, api_client: FantasyFootballAPIClient):
        """Initialize the fetcher."""
        self.espn_client = espn_client
        self.api_client = api_client
        self.league_id_map = {}  # Maps ESPN league ID to DB league ID
    
    def build_league_map(self):
        """Build mapping of ESPN league IDs to database IDs."""
        api_leagues = self.api_client.get_fantasy_leagues(limit=100)
        
        for league in api_leagues:
            espn_league_id = league.get('espn_league_id')
            db_id = league.get('id')
            if espn_league_id and db_id:
                self.league_id_map[espn_league_id] = db_id
        
        logger.info(f"Built league map with {len(self.league_id_map)} leagues")
    
    def transform_team_data(self, espn_team: Dict[str, Any], 
                           league_db_id: int) -> Optional[Dict[str, Any]]:
        """
        Transform ESPN team data to API format.
        
        Args:
            espn_team: Team data from ESPN
            league_db_id: Database league ID
        
        Returns:
            Team data in API format, or None if transformation fails
        """
        try:
            # Debug: Log the team data structure
            logger.debug(f"ESPN team data type: {type(espn_team)}")
            
            if not isinstance(espn_team, dict):
                logger.error(f"Expected dict but got {type(espn_team)}: {espn_team}")
                return None
            
            # Extract owner information - owners field contains GUID strings, not objects
            owners = espn_team.get('owners', [])
            owner_name = "Unknown Owner"
            
            # For now, use a placeholder since we only have GUIDs
            # We could potentially map these GUIDs to actual names later
            if owners and len(owners) > 0:
                owner_guid = owners[0]
                # Use team name or abbreviation as owner name for now
                owner_name = f"Owner of {espn_team.get('name', 'Team')}"
            
            # Build team name from the 'name' field (ESPN provides full team name)
            team_name = espn_team.get('name', '').strip()
            if not team_name:
                team_name = f"Team {espn_team.get('id', 'Unknown')}"
            
            return {
                'league_id': league_db_id,
                'team_name': team_name,
                'owner_name': owner_name,
                'espn_team_id': str(espn_team.get('id', ''))
            }
        
        except Exception as e:
            logger.error(f"Failed to transform team data: {e}")
            logger.error(f"Team data was: {espn_team}")
            return None
    
    def fetch_and_post(self, league_id: str, season: int = 2025) -> Dict[str, Any]:
        """
        Fetch fantasy teams from ESPN and post to API.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
        
        Returns:
            API response with insert/update counts
        """
        logger.info(f"Starting fantasy teams fetch for league {league_id}, season {season}")
        
        try:
            # Build league mapping
            self.build_league_map()
            
            # Get league DB ID
            league_db_id = self.league_id_map.get(league_id)
            if not league_db_id:
                return {
                    "success": False,
                    "message": f"League {league_id} not found in database. Load league info first."
                }
            
            # Fetch teams data
            espn_data = self.espn_client.get_league_teams(league_id, season)
            espn_teams = espn_data.get('teams', [])
            
            if not espn_teams:
                return {
                    "success": False,
                    "message": "No teams found in ESPN response"
                }
            
            # Transform teams
            teams_data = []
            for espn_team in espn_teams:
                team_data = self.transform_team_data(espn_team, league_db_id)
                if team_data:
                    teams_data.append(team_data)
            
            if not teams_data:
                return {
                    "success": False,
                    "message": "No valid teams after transformation"
                }
            
            # Post to API
            result = self.api_client.post_fantasy_teams(teams_data)
            
            logger.info(f"Posted {len(teams_data)} teams: {result}")
            return result
        
        except Exception as e:
            logger.error(f"Failed to fetch teams data: {e}")
            return {
                "success": False,
                "message": f"Error fetching teams data: {str(e)}"
            }