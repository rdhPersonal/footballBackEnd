"""
Fetcher for ESPN Fantasy League draft picks.
"""
import logging
from typing import List, Dict, Any, Optional
from .espn_fantasy_client import ESPNFantasyClient
from .api_client import FantasyFootballAPIClient

logger = logging.getLogger(__name__)


class FantasyDraftFetcher:
    """Fetches fantasy draft picks from ESPN and posts to API."""
    
    def __init__(self, espn_client: ESPNFantasyClient, api_client: FantasyFootballAPIClient):
        """Initialize the fetcher."""
        self.espn_client = espn_client
        self.api_client = api_client
        self.league_id_map = {}  # Maps ESPN league ID to DB league ID
        self.team_id_map = {}    # Maps ESPN team ID to DB team ID
        self.player_id_map = {}  # Maps ESPN player ID to DB player ID
    
    def build_mappings(self, league_id: str):
        """Build mapping of ESPN IDs to database IDs."""
        # Build league mapping
        api_leagues = self.api_client.get_fantasy_leagues(limit=100)
        for league in api_leagues:
            espn_league_id = league.get('espn_league_id')
            db_id = league.get('id')
            if espn_league_id and db_id:
                self.league_id_map[espn_league_id] = db_id
        
        # Build team mapping for this league
        league_db_id = self.league_id_map.get(league_id)
        if league_db_id:
            api_teams = self.api_client.get_fantasy_teams(league_id=league_db_id, limit=100)
            for team in api_teams:
                espn_team_id = team.get('espn_team_id')
                db_id = team.get('id')
                if espn_team_id and db_id:
                    self.team_id_map[espn_team_id] = db_id
        
        # Build player mapping
        api_players = self.api_client.get_nfl_players(limit=5000)
        for player in api_players:
            espn_player_id = player.get('external_id')
            db_id = player.get('id')
            if espn_player_id and db_id:
                # Handle both "espn_123456" and "123456" formats
                if espn_player_id.startswith('espn_'):
                    clean_id = espn_player_id[5:]  # Remove "espn_" prefix
                    self.player_id_map[clean_id] = db_id
                self.player_id_map[espn_player_id] = db_id
        
        logger.info(f"Built mappings: {len(self.league_id_map)} leagues, "
                   f"{len(self.team_id_map)} teams, {len(self.player_id_map)} players")
    
    def transform_draft_pick(self, espn_pick: Dict[str, Any], 
                           league_db_id: int) -> Optional[Dict[str, Any]]:
        """
        Transform ESPN draft pick data to API format.
        
        Args:
            espn_pick: Draft pick data from ESPN
            league_db_id: Database league ID
        
        Returns:
            Draft pick data in API format, or None if transformation fails
        """
        try:
            # Extract pick information
            pick_number = espn_pick.get('overallPickNumber')
            round_number = espn_pick.get('roundId')
            pick_in_round = espn_pick.get('roundPickNumber')
            
            # Get team ID
            espn_team_id = str(espn_pick.get('teamId', ''))
            team_db_id = self.team_id_map.get(espn_team_id)
            
            if not team_db_id:
                logger.warning(f"Team ID {espn_team_id} not found in mapping")
                return None
            
            # Get player ID
            espn_player_id = str(espn_pick.get('playerId', ''))
            player_db_id = self.player_id_map.get(espn_player_id)
            
            if not player_db_id:
                logger.warning(f"Player ID {espn_player_id} not found in mapping")
                return None
            
            return {
                'league_id': league_db_id,
                'fantasy_team_id': team_db_id,
                'player_id': player_db_id,
                'pick_number': pick_number,
                'round': round_number,
                'pick_in_round': pick_in_round,
                'espn_pick_id': str(espn_pick.get('id', ''))
            }
        
        except Exception as e:
            logger.error(f"Failed to transform draft pick: {e}")
            logger.error(f"Pick data was: {espn_pick}")
            return None
    
    def fetch_and_post(self, league_id: str, season: int = 2025) -> Dict[str, Any]:
        """
        Fetch draft picks from ESPN and post to API.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
        
        Returns:
            API response with insert/update counts
        """
        logger.info(f"Starting draft picks fetch for league {league_id}, season {season}")
        
        try:
            # Build mappings
            self.build_mappings(league_id)
            
            # Get league DB ID
            league_db_id = self.league_id_map.get(league_id)
            if not league_db_id:
                return {
                    "success": False,
                    "message": f"League {league_id} not found in database. Load league info first."
                }
            
            # Fetch draft data
            espn_data = self.espn_client.get_league_draft(league_id, season)
            
            # Extract draft picks from the response
            draft_picks = []
            if 'draftDetail' in espn_data:
                draft_detail = espn_data['draftDetail']
                if 'picks' in draft_detail:
                    draft_picks = draft_detail['picks']
            
            if not draft_picks:
                return {
                    "success": False,
                    "message": "No draft picks found in ESPN response"
                }
            
            # Transform picks
            picks_data = []
            for espn_pick in draft_picks:
                pick_data = self.transform_draft_pick(espn_pick, league_db_id)
                if pick_data:
                    picks_data.append(pick_data)
            
            if not picks_data:
                return {
                    "success": False,
                    "message": "No valid draft picks after transformation"
                }
            
            # Post to API
            result = self.api_client.post_draft_picks(picks_data)
            
            logger.info(f"Posted {len(picks_data)} draft picks: {result}")
            return result
        
        except Exception as e:
            logger.error(f"Failed to fetch draft data: {e}")
            return {
                "success": False,
                "message": f"Error fetching draft data: {str(e)}"
            }