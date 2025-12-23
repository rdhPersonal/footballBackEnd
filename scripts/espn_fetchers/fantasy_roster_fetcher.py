"""
Fetcher for ESPN Fantasy League rosters.
"""
import logging
from typing import List, Dict, Any, Optional
from .espn_fantasy_client import ESPNFantasyClient
from .api_client import FantasyFootballAPIClient

logger = logging.getLogger(__name__)


class FantasyRosterFetcher:
    """Fetches fantasy rosters from ESPN and posts to API."""
    
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
    
    def transform_roster_entry(self, espn_entry: Dict[str, Any], 
                              team_db_id: int, week: int) -> Optional[Dict[str, Any]]:
        """
        Transform ESPN roster entry data to API format.
        
        Args:
            espn_entry: Roster entry data from ESPN
            team_db_id: Database team ID
            week: Week number (not used for roster entries)
        
        Returns:
            Roster entry data in API format, or None if transformation fails
        """
        try:
            # Get player ID
            espn_player_id = str(espn_entry.get('playerId', ''))
            player_db_id = self.player_id_map.get(espn_player_id)
            
            if not player_db_id:
                logger.warning(f"Player ID {espn_player_id} not found in mapping")
                return None
            
            # For current rosters, assume acquired at start of season
            # In a real implementation, you'd track actual acquisition dates
            acquired_date = "2025-09-01"  # Start of fantasy season
            
            # Determine acquisition type based on lineup slot
            lineup_slot_id = espn_entry.get('lineupSlotId', 20)  # Default to bench
            acquisition_type = "draft" if lineup_slot_id != 20 else "waiver"
            
            return {
                'fantasy_team_id': team_db_id,
                'player_id': player_db_id,
                'acquired_date': acquired_date,
                'acquisition_type': acquisition_type
            }
        
        except Exception as e:
            logger.error(f"Failed to transform roster entry: {e}")
            logger.error(f"Entry data was: {espn_entry}")
            return None
    
    def fetch_and_post(self, league_id: str, season: int = 2025, 
                      week: Optional[int] = None) -> Dict[str, Any]:
        """
        Fetch rosters from ESPN and post to API.
        
        Args:
            league_id: ESPN league ID
            season: Fantasy season year
            week: Week number (current week if None)
        
        Returns:
            API response with insert/update counts
        """
        logger.info(f"Starting roster fetch for league {league_id}, season {season}, week {week}")
        
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
            
            # Fetch roster data
            espn_data = self.espn_client.get_league_rosters(league_id, season, week)
            espn_teams = espn_data.get('teams', [])
            
            if not espn_teams:
                return {
                    "success": False,
                    "message": "No teams found in ESPN roster response"
                }
            
            # Transform roster entries
            roster_entries = []
            current_week = week or 1  # Default to week 1 if not specified
            
            for espn_team in espn_teams:
                espn_team_id = str(espn_team.get('id', ''))
                team_db_id = self.team_id_map.get(espn_team_id)
                
                if not team_db_id:
                    logger.warning(f"Team ID {espn_team_id} not found in mapping")
                    continue
                
                # Get roster entries for this team
                roster = espn_team.get('roster', {})
                entries = roster.get('entries', [])
                
                for espn_entry in entries:
                    entry_data = self.transform_roster_entry(espn_entry, team_db_id, current_week)
                    if entry_data:
                        roster_entries.append(entry_data)
            
            if not roster_entries:
                return {
                    "success": False,
                    "message": "No valid roster entries after transformation"
                }
            
            # Post to API
            result = self.api_client.post_roster_entries(roster_entries)
            
            logger.info(f"Posted {len(roster_entries)} roster entries: {result}")
            return result
        
        except Exception as e:
            logger.error(f"Failed to fetch roster data: {e}")
            return {
                "success": False,
                "message": f"Error fetching roster data: {str(e)}"
            }