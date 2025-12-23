"""
Client for fetching data from ESPN Fantasy Football APIs.
"""
import requests
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class ESPNFantasyClient:
    """Client for fetching Fantasy Football data from ESPN APIs."""
    
    BASE_URL = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons"
    
    def __init__(self, username: str = None, password: str = None, 
                 espn_s2: str = None, swid: str = None):
        """
        Initialize the ESPN Fantasy client.
        
        Args:
            username: ESPN username (for login authentication)
            password: ESPN password (for login authentication)  
            espn_s2: ESPN S2 cookie (for private leagues)
            swid: ESPN SWID cookie (for private leagues)
        """
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; ESPN-Fantasy-Fetcher/1.0)',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
        
        # Store credentials
        self.username = username
        self.password = password
        self.espn_s2 = espn_s2
        self.swid = swid
        
        # Set up authentication
        self._setup_authentication()
    
    def _setup_authentication(self):
        """Set up authentication for ESPN Fantasy APIs."""
        if self.espn_s2 and self.swid:
            # Use cookies for private league access
            self.session.cookies.set('espn_s2', self.espn_s2)
            self.session.cookies.set('SWID', self.swid)
            logger.info("Using ESPN S2/SWID cookie authentication")
        elif self.username and self.password:
            # Login with username/password to get cookies
            self._login()
        else:
            logger.info("No authentication provided - public leagues only")
    
    def _login(self):
        """Login to ESPN to get authentication cookies."""
        login_url = "https://registerdisney.go.com/jgc/v5/client/ESPN-ONESITE.WEB-PROD/guest/login"
        
        login_data = {
            'loginValue': self.username,
            'password': self.password
        }
        
        try:
            logger.info(f"Logging in to ESPN as {self.username}")
            response = self.session.post(login_url, json=login_data)
            
            if response.status_code == 200:
                # Extract cookies from response
                espn_s2 = self.session.cookies.get('espn_s2')
                swid = self.session.cookies.get('SWID')
                
                if espn_s2 and swid:
                    logger.info("Successfully logged in to ESPN")
                    self.espn_s2 = espn_s2
                    self.swid = swid
                else:
                    logger.warning("Login successful but no auth cookies found")
            else:
                logger.error(f"ESPN login failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Failed to login to ESPN: {e}")
    
    def get_league_info(self, league_id: str, season: int = 2025) -> Dict[str, Any]:
        """
        Fetch basic league information.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
        
        Returns:
            League information
        """
        url = f"{self.BASE_URL}/{season}/segments/0/leagues/{league_id}"
        params = {'view': 'mSettings'}
        
        logger.info(f"Fetching league info for league {league_id}, season {season}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def get_league_teams(self, league_id: str, season: int = 2025) -> Dict[str, Any]:
        """
        Fetch all teams in the league.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
        
        Returns:
            League teams data
        """
        url = f"{self.BASE_URL}/{season}/segments/0/leagues/{league_id}"
        params = {'view': 'mTeam'}
        
        logger.info(f"Fetching teams for league {league_id}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def get_league_rosters(self, league_id: str, season: int = 2025, 
                          week: Optional[int] = None) -> Dict[str, Any]:
        """
        Fetch current rosters for all teams.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
            week: Specific week (current week if None)
        
        Returns:
            Roster data for all teams
        """
        url = f"{self.BASE_URL}/{season}/segments/0/leagues/{league_id}"
        params = {'view': 'mRoster'}
        
        if week:
            params['scoringPeriodId'] = week
        
        logger.info(f"Fetching rosters for league {league_id}, week {week}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def get_league_draft(self, league_id: str, season: int = 2025) -> Dict[str, Any]:
        """
        Fetch draft results for the league.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
        
        Returns:
            Draft picks data
        """
        url = f"{self.BASE_URL}/{season}/segments/0/leagues/{league_id}"
        params = {'view': 'mDraftDetail'}
        
        logger.info(f"Fetching draft for league {league_id}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def get_league_transactions(self, league_id: str, season: int = 2025) -> Dict[str, Any]:
        """
        Fetch all transactions (trades, pickups, drops) for the league.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
        
        Returns:
            Transaction data
        """
        url = f"{self.BASE_URL}/{season}/segments/0/leagues/{league_id}"
        params = {'view': 'mTransactions2'}
        
        logger.info(f"Fetching transactions for league {league_id}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def get_league_matchups(self, league_id: str, season: int = 2025, 
                           week: Optional[int] = None) -> Dict[str, Any]:
        """
        Fetch matchups for a specific week.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
            week: Week number (current week if None)
        
        Returns:
            Matchup data
        """
        url = f"{self.BASE_URL}/{season}/segments/0/leagues/{league_id}"
        params = {'view': 'mMatchup'}
        
        if week:
            params['scoringPeriodId'] = week
        
        logger.info(f"Fetching matchups for league {league_id}, week {week}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def get_league_scoreboard(self, league_id: str, season: int = 2025, 
                             week: Optional[int] = None) -> Dict[str, Any]:
        """
        Fetch scoreboard with lineups and scores for a week.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
            week: Week number (current week if None)
        
        Returns:
            Scoreboard data with lineups and scores
        """
        url = f"{self.BASE_URL}/{season}/segments/0/leagues/{league_id}"
        params = {'view': 'mScoreboard'}
        
        if week:
            params['scoringPeriodId'] = week
        
        logger.info(f"Fetching scoreboard for league {league_id}, week {week}")
        
        response = self.session.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def test_league_access(self, league_id: str, season: int = 2025) -> bool:
        """
        Test if we can access the league (public vs private).
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
        
        Returns:
            True if accessible, False otherwise
        """
        try:
            data = self.get_league_info(league_id, season)
            return 'settings' in data or 'teams' in data
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                logger.warning(f"League {league_id} requires authentication (private league)")
                return False
            else:
                logger.error(f"Error accessing league {league_id}: {e}")
                return False
        except Exception as e:
            logger.error(f"Unexpected error testing league access: {e}")
            return False