"""
Fetcher for NFL teams from ESPN.
"""
import logging
from typing import List, Dict, Any
from .espn_client import ESPNClient
from .api_client import FantasyFootballAPIClient

logger = logging.getLogger(__name__)


class NFLTeamsFetcher:
    """Fetches NFL teams from ESPN and posts to API."""
    
    def __init__(self, espn_client: ESPNClient, api_client: FantasyFootballAPIClient):
        """Initialize the fetcher."""
        self.espn_client = espn_client
        self.api_client = api_client
    
    def transform_team(self, espn_team: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform ESPN team data to API format.
        
        Args:
            espn_team: Team data from ESPN
        
        Returns:
            Team data in API format
        """
        # Extract location and name
        location = espn_team.get('location', '')
        name = espn_team.get('name', '')
        abbreviation = espn_team.get('abbreviation', '')
        
        # Get conference and division from groups
        groups = espn_team.get('groups', {})
        conference = None
        division = None
        
        if 'parent' in groups:
            # Parent is conference (AFC/NFC)
            parent = groups['parent']
            if parent.get('isConference'):
                conference = parent.get('abbreviation', '')
        
        if 'id' in groups:
            # Main group is division
            group_id = groups['id']
            # Division format: "1" = AFC East, "2" = AFC North, etc.
            # We'll extract from the name
            group_name = groups.get('name', '')
            if 'East' in group_name:
                division = 'East'
            elif 'West' in group_name:
                division = 'West'
            elif 'North' in group_name:
                division = 'North'
            elif 'South' in group_name:
                division = 'South'
        
        return {
            'team_code': abbreviation,
            'team_name': name,
            'city': location,
            'conference': conference or 'AFC',  # Default if not found
            'division': division or 'East'  # Default if not found
        }
    
    def fetch_and_post(self) -> Dict[str, Any]:
        """
        Fetch NFL teams from ESPN and post to API.
        
        Returns:
            API response with insert/update counts
        """
        logger.info("Starting NFL teams fetch")
        
        # Fetch from ESPN
        espn_teams = self.espn_client.get_teams()
        
        # Transform to API format
        api_teams = []
        for espn_team in espn_teams:
            try:
                api_team = self.transform_team(espn_team)
                api_teams.append(api_team)
            except Exception as e:
                logger.error(f"Failed to transform team {espn_team.get('abbreviation')}: {e}")
        
        logger.info(f"Transformed {len(api_teams)} teams")
        
        # Post to API
        if api_teams:
            result = self.api_client.post_nfl_teams(api_teams)
            logger.info(f"Posted teams: {result}")
            return result
        else:
            logger.warning("No teams to post")
            return {"success": False, "message": "No teams fetched"}
