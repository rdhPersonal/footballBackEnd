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
    
    def extract_stat_value(self, stats: List[Dict], stat_name: str) -> int:
        """Extract a stat value from ESPN stats array."""
        for stat in stats:
            if stat.get('name') == stat_name:
                return int(float(stat.get('value', 0)))
        return 0
    
    def extract_stat_value_float(self, stats: List[Dict], stat_name: str) -> float:
        """Extract a float stat value from ESPN stats array."""
        for stat in stats:
            if stat.get('name') == stat_name:
                return float(stat.get('value', 0))
        return 0.0
    
    def transform_player_stats(self, espn_stats: Dict[str, Any], 
                               game_id: int) -> Optional[Dict[str, Any]]:
        """
        Transform ESPN player stats to API format.
        
        Args:
            espn_stats: Player stats data from ESPN
            game_id: Database game ID
        
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
            
            return {
                'player_id': player_db_id,
                'nfl_game_id': game_id,
                
                # Passing
                'passing_attempts': self.extract_stat_value(stats, 'passingAttempts'),
                'passing_completions': self.extract_stat_value(stats, 'completions'),
                'passing_yards': self.extract_stat_value(stats, 'passingYards'),
                'passing_touchdowns': self.extract_stat_value(stats, 'passingTouchdowns'),
                'interceptions': self.extract_stat_value(stats, 'interceptions'),
                
                # Rushing
                'rushing_attempts': self.extract_stat_value(stats, 'rushingAttempts'),
                'rushing_yards': self.extract_stat_value(stats, 'rushingYards'),
                'rushing_touchdowns': self.extract_stat_value(stats, 'rushingTouchdowns'),
                
                # Receiving
                'receptions': self.extract_stat_value(stats, 'receptions'),
                'receiving_yards': self.extract_stat_value(stats, 'receivingYards'),
                'receiving_touchdowns': self.extract_stat_value(stats, 'receivingTouchdowns'),
                'targets': self.extract_stat_value(stats, 'receivingTargets'),
                
                # Other
                'fumbles_lost': self.extract_stat_value(stats, 'fumblesLost'),
                'two_point_conversions': self.extract_stat_value(stats, 'twoPtConversions'),
                
                # Kicker
                'field_goals_made': self.extract_stat_value(stats, 'fieldGoalsMade'),
                'field_goals_attempted': self.extract_stat_value(stats, 'fieldGoalsAttempted'),
                'extra_points_made': self.extract_stat_value(stats, 'extraPointsMade'),
                'extra_points_attempted': self.extract_stat_value(stats, 'extraPointsAttempted'),
                
                # Defense
                'sacks': self.extract_stat_value_float(stats, 'sacks'),
                'interceptions_defense': self.extract_stat_value(stats, 'interceptions'),
                'fumbles_recovered': self.extract_stat_value(stats, 'fumblesRecovered'),
                'touchdowns_defense': self.extract_stat_value(stats, 'defensiveTouchdowns'),
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
            
            all_stats = []
            
            # Extract box score
            boxscore = summary.get('boxscore', {})
            players = boxscore.get('players', [])
            
            for team_players in players:
                # Each team has multiple stat categories
                statistics = team_players.get('statistics', [])
                
                for stat_category in statistics:
                    athletes = stat_category.get('athletes', [])
                    
                    for athlete_stats in athletes:
                        player_stat = self.transform_player_stats(athlete_stats, game_db_id)
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
            # We need the ESPN game ID - we don't have it stored
            # For now, we'll skip this and note it needs to be added to the schema
            logger.warning("ESPN game ID not stored in database - cannot fetch detailed stats")
            logger.info("To enable stats fetching, add 'external_id' column to nfl_games table")
            break
        
        # For now, return a message about the limitation
        return {
            "success": False,
            "message": "Stats fetching requires external_id field in nfl_games table",
            "note": "Add external_id VARCHAR(50) to nfl_games table to store ESPN game IDs"
        }
