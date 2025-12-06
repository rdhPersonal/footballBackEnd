"""
Client for fetching data from ESPN APIs.
"""
import requests
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class ESPNClient:
    """Client for fetching NFL data from ESPN APIs."""
    
    BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
    
    def __init__(self):
        """Initialize the ESPN client."""
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; ESPN-NFL-Fetcher/1.0)'
        })
    
    def get_teams(self) -> List[Dict[str, Any]]:
        """
        Fetch all NFL teams from ESPN.
        
        Returns:
            List of team data dictionaries
        """
        url = f"{self.BASE_URL}/teams"
        logger.info(f"Fetching NFL teams from {url}")
        
        response = self.session.get(url)
        response.raise_for_status()
        
        data = response.json()
        teams = []
        
        # ESPN returns teams grouped by conference/division
        if 'sports' in data and len(data['sports']) > 0:
            leagues = data['sports'][0].get('leagues', [])
            if leagues:
                for team_data in leagues[0].get('teams', []):
                    team = team_data.get('team', {})
                    teams.append(team)
        
        logger.info(f"Fetched {len(teams)} NFL teams")
        return teams
    
    def get_scoreboard(self, season: int = 2025, week: Optional[int] = None, 
                       season_type: int = 2) -> Dict[str, Any]:
        """
        Fetch NFL scoreboard/schedule from ESPN.
        
        Args:
            season: NFL season year
            week: Week number (1-18 for regular season)
            season_type: 1=preseason, 2=regular, 3=postseason
        
        Returns:
            Scoreboard data with games
        """
        params = {
            'seasontype': season_type,
            'dates': season
        }
        
        if week:
            params['week'] = week
        
        url = f"{self.BASE_URL}/scoreboard"
        logger.info(f"Fetching scoreboard for season {season}, week {week}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        logger.info(f"Fetched {len(data.get('events', []))} games")
        return data
    
    def get_game_summary(self, game_id: str) -> Dict[str, Any]:
        """
        Fetch detailed game summary including player stats.
        
        Args:
            game_id: ESPN game ID
        
        Returns:
            Game summary data
        """
        url = f"{self.BASE_URL}/summary"
        params = {'event': game_id}
        
        logger.info(f"Fetching game summary for game {game_id}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def get_team_roster(self, team_id: str) -> Dict[str, Any]:
        """
        Fetch team roster from ESPN.
        
        Args:
            team_id: ESPN team ID
        
        Returns:
            Team roster data
        """
        url = f"{self.BASE_URL}/teams/{team_id}/roster"
        logger.info(f"Fetching roster for team {team_id}")
        
        response = self.session.get(url)
        response.raise_for_status()
        
        return response.json()
    
    def get_all_rosters(self, team_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fetch rosters for multiple teams.
        
        Args:
            team_ids: List of ESPN team IDs
        
        Returns:
            Dictionary mapping team_id to roster data
        """
        rosters = {}
        for team_id in team_ids:
            try:
                rosters[team_id] = self.get_team_roster(team_id)
            except Exception as e:
                logger.error(f"Failed to fetch roster for team {team_id}: {e}")
        
        return rosters
