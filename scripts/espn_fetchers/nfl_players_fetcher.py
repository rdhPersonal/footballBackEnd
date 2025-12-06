"""
Fetcher for NFL players from ESPN.
"""
import logging
from typing import List, Dict, Any, Optional
from .espn_client import ESPNClient
from .api_client import FantasyFootballAPIClient

logger = logging.getLogger(__name__)


class NFLPlayersFetcher:
    """Fetches NFL players from ESPN team rosters and posts to API."""
    
    def __init__(self, espn_client: ESPNClient, api_client: FantasyFootballAPIClient):
        """Initialize the fetcher."""
        self.espn_client = espn_client
        self.api_client = api_client
        self.team_id_map = {}  # Maps ESPN team ID to our DB team ID
    
    def build_team_id_map(self):
        """Build mapping of ESPN team abbreviations to our database team IDs."""
        api_teams = self.api_client.get_nfl_teams()
        
        for team in api_teams:
            team_code = team.get('team_code')
            db_id = team.get('id')
            if team_code and db_id:
                self.team_id_map[team_code] = db_id
        
        logger.info(f"Built team ID map with {len(self.team_id_map)} teams")
    
    def transform_player(self, espn_player: Dict[str, Any], 
                        team_abbreviation: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Transform ESPN player data to API format.
        
        Args:
            espn_player: Player data from ESPN
            team_abbreviation: Team abbreviation for looking up team ID
        
        Returns:
            Player data in API format, or None if transformation fails
        """
        try:
            athlete = espn_player.get('athlete', espn_player)
            
            # Get player ID
            player_id = athlete.get('id')
            if not player_id:
                return None
            
            # Get name
            full_name = athlete.get('fullName', '')
            display_name = athlete.get('displayName', full_name)
            
            # Split name into first/last
            name_parts = display_name.split(' ', 1)
            first_name = name_parts[0] if len(name_parts) > 0 else ''
            last_name = name_parts[1] if len(name_parts) > 1 else ''
            
            # Get position
            position = athlete.get('position', {})
            if isinstance(position, dict):
                position_abbr = position.get('abbreviation', 'UNK')
            else:
                position_abbr = str(position) if position else 'UNK'
            
            # Get jersey number
            jersey = athlete.get('jersey')
            jersey_number = int(jersey) if jersey and str(jersey).isdigit() else None
            
            # Get team ID from our database
            nfl_team_id = None
            if team_abbreviation and team_abbreviation in self.team_id_map:
                nfl_team_id = self.team_id_map[team_abbreviation]
            
            # Get status
            status = athlete.get('status', {})
            if isinstance(status, dict):
                status_type = status.get('type', 'active')
            else:
                status_type = 'active'
            
            return {
                'external_id': f"espn_{player_id}",
                'first_name': first_name,
                'last_name': last_name,
                'position': position_abbr,
                'nfl_team_id': nfl_team_id,
                'jersey_number': jersey_number,
                'status': status_type
            }
        
        except Exception as e:
            logger.error(f"Failed to transform player: {e}")
            return None
    
    def fetch_and_post(self, team_abbreviations: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Fetch NFL players from ESPN and post to API.
        
        Args:
            team_abbreviations: Optional list of team abbreviations to fetch.
                              If None, fetches all teams.
        
        Returns:
            API response with insert/update counts
        """
        logger.info("Starting NFL players fetch")
        
        # Build team ID mapping
        self.build_team_id_map()
        
        # Get team IDs to fetch
        if team_abbreviations:
            team_ids = [abbr for abbr in team_abbreviations if abbr in self.team_id_map]
        else:
            team_ids = list(self.team_id_map.keys())
        
        logger.info(f"Fetching rosters for {len(team_ids)} teams")
        
        # Fetch rosters from ESPN
        all_players = []
        for team_abbr in team_ids:
            try:
                # ESPN uses team abbreviation in lowercase for roster endpoint
                roster_data = self.espn_client.get_team_roster(team_abbr.lower())
                
                # Extract athletes from roster
                athletes = roster_data.get('athletes', [])
                
                for athlete_group in athletes:
                    # Athletes are grouped by position
                    items = athlete_group.get('items', [])
                    for item in items:
                        player = self.transform_player(item, team_abbr)
                        if player:
                            all_players.append(player)
                
                logger.info(f"Fetched {len(items)} players from {team_abbr}")
            
            except Exception as e:
                logger.error(f"Failed to fetch roster for {team_abbr}: {e}")
        
        logger.info(f"Transformed {len(all_players)} total players")
        
        # Post to API in batches (API can handle bulk, but let's be safe)
        if all_players:
            batch_size = 100
            total_inserted = 0
            total_updated = 0
            
            for i in range(0, len(all_players), batch_size):
                batch = all_players[i:i + batch_size]
                try:
                    result = self.api_client.post_nfl_players(batch)
                    total_inserted += result.get('inserted_count', 0)
                    total_updated += result.get('updated_count', 0)
                except Exception as e:
                    logger.error(f"Failed to post player batch {i}-{i+len(batch)}: {e}")
            
            final_result = {
                "success": True,
                "inserted_count": total_inserted,
                "updated_count": total_updated,
                "message": f"Posted {len(all_players)} players: {total_inserted} inserted, {total_updated} updated"
            }
            logger.info(f"Posted players: {final_result}")
            return final_result
        else:
            logger.warning("No players to post")
            return {"success": False, "message": "No players fetched"}
