"""
Fetcher for NFL player game statistics from ESPN.
"""
import logging
from typing import List, Dict, Any, Optional
from .espn_client import ESPNClient
from .api_client import FantasyFootballAPIClient

logger = logging.getLogger(__name__)


class NFLStatsFetcher:
    """Fetches NFL player game stats from ESPN and posts to API."""
    
    def __init__(self, espn_client: ESPNClient, api_client: FantasyFootballAPIClient):
        """Initialize the fetcher."""
        self.espn_client = espn_client
        self.api_client = api_client
        self.player_external_id_to_db_id = {}  # Maps ESPN player ID to DB ID
        self.game_map = {}  # Maps (home_team_id, away_team_id, week) to game DB ID
    
    def build_player_map(self):
        """Build mapping of ESPN player IDs to database IDs."""
        api_players = self.api_client.get_nfl_players(limit=5000)
        
        for player in api_players:
            external_id = player.get('external_id')
            db_id = player.get('id')
            if external_id and db_id:
                self.player_external_id_to_db_id[external_id] = db_id
        
        logger.info(f"Built player map with {len(self.player_external_id_to_db_id)} players")
    
    def build_game_map(self, season: int = 2025):
        """Build mapping of game identifiers to database IDs."""
        api_games = self.api_client.get_nfl_games(season=season, limit=500)
        
        for game in api_games:
            home_id = game.get('home_team_id')
            away_id = game.get('away_team_id')
            week = game.get('week')
            db_id = game.get('id')
            
            if home_id and away_id and week and db_id:
                key = (home_id, away_id, week)
                self.game_map[key] = db_id
        
        logger.info(f"Built game map with {len(self.game_map)} games")
    
    def extract_stat_by_key(self, stats: List[str], keys: List[str], key_name: str) -> int:
        """Extract a stat value by key name from ESPN stats array."""
        try:
            if key_name in keys:
                index = keys.index(key_name)
                if index < len(stats):
                    value = stats[index]
                    # Handle compound values like "21/34" for completions/attempts
                    if '/' in value and key_name == 'completions/passingAttempts':
                        return int(value.split('/')[0])  # Return completions
                    elif '-' in value and 'sacks' in key_name:
                        return int(float(value.split('-')[0]))  # Return sacks count
                    else:
                        return int(float(value))
            return 0
        except (ValueError, IndexError):
            return 0
    
    def extract_stat_by_key_float(self, stats: List[str], keys: List[str], key_name: str) -> float:
        """Extract a float stat value by key name from ESPN stats array."""
        try:
            if key_name in keys:
                index = keys.index(key_name)
                if index < len(stats):
                    value = stats[index]
                    if '-' in value and 'sacks' in key_name:
                        return float(value.split('-')[0])  # Return sacks count
                    else:
                        return float(value)
            return 0.0
        except (ValueError, IndexError):
            return 0.0
    
    def extract_passing_attempts(self, stats: List[str], keys: List[str]) -> int:
        """Extract passing attempts from completions/passingAttempts field."""
        try:
            if 'completions/passingAttempts' in keys:
                index = keys.index('completions/passingAttempts')
                if index < len(stats):
                    value = stats[index]
                    if '/' in value:
                        return int(value.split('/')[1])  # Return attempts
            return 0
        except (ValueError, IndexError):
            return 0
    
    def transform_player_stats(self, espn_stats: Dict[str, Any], 
                               game_id: int, 
                               category_keys: List[str] = None) -> Optional[Dict[str, Any]]:
        """
        Transform ESPN player stats to API format.
        
        Args:
            espn_stats: Player stats data from ESPN
            game_id: Database game ID
            category_keys: List of stat keys for this category
        
        Returns:
            Stats data in API format, or None if transformation fails
        """
        try:
            athlete = espn_stats.get('athlete', {})
            player_espn_id = athlete.get('id')
            
            if not player_espn_id:
                return None
            
            # Get player DB ID
            external_id = f"espn_{player_espn_id}"
            player_db_id = self.player_external_id_to_db_id.get(external_id)
            
            if not player_db_id:
                logger.debug(f"Player {external_id} not found in database")
                return None
            
            # Extract stats
            stats = espn_stats.get('stats', [])
            if not category_keys:
                category_keys = []
            
            return {
                'player_id': player_db_id,
                'nfl_game_id': game_id,
                
                # Passing
                'passing_attempts': self.extract_passing_attempts(stats, category_keys),
                'passing_completions': self.extract_stat_by_key(stats, category_keys, 'completions/passingAttempts'),
                'passing_yards': self.extract_stat_by_key(stats, category_keys, 'passingYards'),
                'passing_touchdowns': self.extract_stat_by_key(stats, category_keys, 'passingTouchdowns'),
                'interceptions': self.extract_stat_by_key(stats, category_keys, 'interceptions'),
                
                # Rushing
                'rushing_attempts': self.extract_stat_by_key(stats, category_keys, 'rushingAttempts'),
                'rushing_yards': self.extract_stat_by_key(stats, category_keys, 'rushingYards'),
                'rushing_touchdowns': self.extract_stat_by_key(stats, category_keys, 'rushingTouchdowns'),
                
                # Receiving
                'receptions': self.extract_stat_by_key(stats, category_keys, 'receptions'),
                'receiving_yards': self.extract_stat_by_key(stats, category_keys, 'receivingYards'),
                'receiving_touchdowns': self.extract_stat_by_key(stats, category_keys, 'receivingTouchdowns'),
                'targets': self.extract_stat_by_key(stats, category_keys, 'receivingTargets'),
                
                # Other
                'fumbles_lost': self.extract_stat_by_key(stats, category_keys, 'fumblesLost'),
                'two_point_conversions': self.extract_stat_by_key(stats, category_keys, 'twoPtConversions'),
                
                # Kicker
                'field_goals_made': self.extract_stat_by_key(stats, category_keys, 'fieldGoalsMade'),
                'field_goals_attempted': self.extract_stat_by_key(stats, category_keys, 'fieldGoalsAttempted'),
                'extra_points_made': self.extract_stat_by_key(stats, category_keys, 'extraPointsMade'),
                'extra_points_attempted': self.extract_stat_by_key(stats, category_keys, 'extraPointsAttempted'),
                
                # Defense
                'sacks': self.extract_stat_by_key_float(stats, category_keys, 'sacks-sackYardsLost'),
                'interceptions_defense': self.extract_stat_by_key(stats, category_keys, 'interceptions'),
                'fumbles_recovered': self.extract_stat_by_key(stats, category_keys, 'fumblesRecovered'),
                'touchdowns_defense': self.extract_stat_by_key(stats, category_keys, 'defensiveTouchdowns'),
                'points_allowed': 0  # Not typically in player stats
            }
        
        except Exception as e:
            logger.error(f"Failed to transform player stats: {e}")
            return None
    
    def fetch_game_stats(self, game_espn_id: str, game_db_id: int) -> List[Dict[str, Any]]:
        """
        Fetch stats for a single game.
        
        Args:
            game_espn_id: ESPN game ID
            game_db_id: Database game ID
        
        Returns:
            List of player stats
        """
        try:
            summary = self.espn_client.get_game_summary(game_espn_id)
            
            # Debug: Log the structure we're getting
            logger.debug(f"Game summary keys: {list(summary.keys())}")
            
            all_stats = []
            
            # Extract box score
            boxscore = summary.get('boxscore', {})
            logger.debug(f"Boxscore keys: {list(boxscore.keys()) if boxscore else 'No boxscore'}")
            
            players = boxscore.get('players', [])
            logger.info(f"Processing {len(players)} team player groups")
            
            for i, team_players in enumerate(players):
                # Each team has multiple stat categories
                statistics = team_players.get('statistics', [])
                logger.debug(f"Team {i} has {len(statistics)} stat categories")
                
                for j, stat_category in enumerate(statistics):
                    # Log the category info
                    if isinstance(stat_category, dict):
                        category_name = stat_category.get('name', 'Unknown')
                        category_keys = stat_category.get('keys', [])
                        logger.debug(f"Team {i}, Category {j} ({category_name}): {len(stat_category.get('athletes', []))} athletes")
                    
                    athletes = stat_category.get('athletes', [])
                    
                    for k, athlete_stats in enumerate(athletes):
                        player_stat = self.transform_player_stats(athlete_stats, game_db_id, category_keys)
                        if player_stat:
                            all_stats.append(player_stat)
            
            return all_stats
        
        except Exception as e:
            logger.error(f"Failed to fetch stats for game {game_espn_id}: {e}")
            return []
    
    def fetch_and_post(self, season: int = 2025, weeks: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Fetch NFL player stats from ESPN and post to API.
        
        Args:
            season: Season year
            weeks: List of week numbers to fetch stats for
        
        Returns:
            API response with insert/update counts
        """
        logger.info(f"Starting NFL stats fetch for season {season}")
        
        # Build mappings
        self.build_player_map()
        self.build_game_map(season)
        
        # Get games from API to know which games to fetch stats for
        api_games = self.api_client.get_nfl_games(season=season, limit=500)
        
        # Filter by weeks if specified
        if weeks:
            api_games = [g for g in api_games if g.get('week') in weeks]
        
        logger.info(f"Fetching stats for {len(api_games)} games")
        
        all_stats = []
        
        for game in api_games:
            external_id = game.get('external_id')
            game_db_id = game.get('id')
            
            if not external_id:
                logger.warning(f"Game {game_db_id} missing external_id, skipping")
                continue
            
            # Extract ESPN game ID from external_id (format: "espn_401772510")
            if external_id.startswith('espn_'):
                espn_game_id = external_id.replace('espn_', '')
            else:
                espn_game_id = external_id
            
            logger.info(f"Fetching stats for game {espn_game_id} (week {game.get('week')})")
            
            game_stats = self.fetch_game_stats(espn_game_id, game_db_id)
            all_stats.extend(game_stats)
        
        logger.info(f"Fetched {len(all_stats)} total player stats")
        
        # Post to API in batches
        if all_stats:
            batch_size = 100
            total_inserted = 0
            total_updated = 0
            
            for i in range(0, len(all_stats), batch_size):
                batch = all_stats[i:i + batch_size]
                try:
                    result = self.api_client.post_nfl_stats(batch)
                    total_inserted += result.get('inserted_count', 0)
                    total_updated += result.get('updated_count', 0)
                except Exception as e:
                    logger.error(f"Failed to post stats batch {i}-{i+len(batch)}: {e}")
            
            final_result = {
                "success": True,
                "inserted_count": total_inserted,
                "updated_count": total_updated,
                "message": f"Posted {len(all_stats)} stats: {total_inserted} inserted, {total_updated} updated"
            }
            logger.info(f"Posted stats: {final_result}")
            return final_result
        else:
            logger.warning("No stats to post")
            return {"success": False, "message": "No stats fetched"}
