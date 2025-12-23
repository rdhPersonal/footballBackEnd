"""
Client for interacting with the Fantasy Football AWS API.
"""
import requests
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class FantasyFootballAPIClient:
    """Client for posting data to the Fantasy Football API."""
    
    def __init__(self, base_url: str):
        """
        Initialize the API client.
        
        Args:
            base_url: Base URL of the API (e.g., https://api.example.com/dev)
        """
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'ESPN-NFL-Fetcher/1.0'
        })
    
    def post_nfl_teams(self, teams: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post NFL teams to the API."""
        url = f"{self.base_url}/api/nfl/teams"
        payload = {"teams": teams}
        
        logger.info(f"Posting {len(teams)} NFL teams to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_nfl_players(self, players: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post NFL players to the API."""
        url = f"{self.base_url}/api/nfl/players"
        payload = {"players": players}
        
        logger.info(f"Posting {len(players)} NFL players to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_nfl_games(self, games: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post NFL games to the API."""
        url = f"{self.base_url}/api/nfl/games"
        payload = {"games": games}
        
        logger.info(f"Posting {len(games)} NFL games to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_nfl_stats(self, stats: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post NFL player stats to the API."""
        url = f"{self.base_url}/api/nfl/stats"
        payload = {"stats": stats}
        
        logger.info(f"Posting {len(stats)} player stats to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def get_nfl_teams(self) -> List[Dict[str, Any]]:
        """Get all NFL teams from the API."""
        url = f"{self.base_url}/api/nfl/teams"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
    
    def get_nfl_players(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get NFL players from the API."""
        url = f"{self.base_url}/api/nfl/players?limit={limit}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
    
    def get_nfl_games(self, season: int = 2025, limit: int = 500) -> List[Dict[str, Any]]:
        """Get NFL games from the API."""
        url = f"{self.base_url}/api/nfl/games?season={season}&limit={limit}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
    
    # Fantasy League Methods
    def post_fantasy_leagues(self, leagues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post fantasy leagues to the API."""
        url = f"{self.base_url}/api/fantasy/leagues"
        payload = {"leagues": leagues}
        
        logger.info(f"Posting {len(leagues)} fantasy leagues to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_fantasy_teams(self, teams: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post fantasy teams to the API."""
        url = f"{self.base_url}/api/fantasy/teams"
        payload = {"teams": teams}
        
        logger.info(f"Posting {len(teams)} fantasy teams to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_draft_picks(self, picks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post draft picks to the API."""
        url = f"{self.base_url}/api/fantasy/draft"
        payload = {"picks": picks}
        
        logger.info(f"Posting {len(picks)} draft picks to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_roster_entries(self, entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post roster entries to the API."""
        url = f"{self.base_url}/api/fantasy/rosters"
        payload = {"entries": entries}
        
        logger.info(f"Posting {len(entries)} roster entries to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_transactions(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post transactions to the API."""
        url = f"{self.base_url}/api/fantasy/transactions"
        payload = {"transactions": transactions}
        
        logger.info(f"Posting {len(transactions)} transactions to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_matchups(self, matchups: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post matchups to the API."""
        url = f"{self.base_url}/api/fantasy/matchups"
        payload = {"matchups": matchups}
        
        logger.info(f"Posting {len(matchups)} matchups to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_lineups(self, lineups: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post lineups to the API."""
        url = f"{self.base_url}/api/fantasy/lineups"
        payload = {"lineups": lineups}
        
        logger.info(f"Posting {len(lineups)} lineups to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    def post_fantasy_scores(self, scores: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Post fantasy scores to the API."""
        url = f"{self.base_url}/api/fantasy/scores"
        payload = {"scores": scores}
        
        logger.info(f"Posting {len(scores)} fantasy scores to {url}")
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"Response: {result}")
        return result
    
    # Fantasy GET methods
    def get_fantasy_leagues(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get fantasy leagues from the API."""
        url = f"{self.base_url}/api/fantasy/leagues?limit={limit}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
    
    def get_fantasy_teams(self, league_id: int = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get fantasy teams from the API."""
        url = f"{self.base_url}/api/fantasy/teams?limit={limit}"
        if league_id:
            url += f"&league_id={league_id}"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()
