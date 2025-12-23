"""
Fetcher for NFL games/schedule from ESPN.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from .espn_client import ESPNClient
from .api_client import FantasyFootballAPIClient

logger = logging.getLogger(__name__)


class NFLGamesFetcher:
    """Fetches NFL games from ESPN scoreboard and posts to API."""
    
    def __init__(self, espn_client: ESPNClient, api_client: FantasyFootballAPIClient):
        """Initialize the fetcher."""
        self.espn_client = espn_client
        self.api_client = api_client
        self.team_code_to_id = {}  # Maps team abbreviation to DB ID
    
    def build_team_map(self):
        """Build mapping of team abbreviations to database IDs."""
        api_teams = self.api_client.get_nfl_teams()
        
        for team in api_teams:
            team_code = team.get('team_code')
            db_id = team.get('id')
            if team_code and db_id:
                self.team_code_to_id[team_code] = db_id
        
        logger.info(f"Built team map with {len(self.team_code_to_id)} teams")
    
    def transform_game(self, espn_event: Dict[str, Any], season: int, week: int) -> Optional[Dict[str, Any]]:
        """
        Transform ESPN game event to API format.
        
        Args:
            espn_event: Game event data from ESPN
            season: Season year
            week: Week number
        
        Returns:
            Game data in API format, or None if transformation fails
        """
        try:
            # Get ESPN game ID
            espn_game_id = espn_event.get('id')
            
            # Get game date
            date_str = espn_event.get('date')
            game_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            
            # Get competitions (usually just one)
            competitions = espn_event.get('competitions', [])
            if not competitions:
                return None
            
            competition = competitions[0]
            
            # Get competitors (home/away teams)
            competitors = competition.get('competitors', [])
            if len(competitors) != 2:
                return None
            
            home_team = None
            away_team = None
            
            for competitor in competitors:
                team = competitor.get('team', {})
                team_abbr = team.get('abbreviation')
                score = competitor.get('score')
                
                if competitor.get('homeAway') == 'home':
                    home_team = {
                        'abbreviation': team_abbr,
                        'id': self.team_code_to_id.get(team_abbr),
                        'score': int(score) if score else None
                    }
                else:
                    away_team = {
                        'abbreviation': team_abbr,
                        'id': self.team_code_to_id.get(team_abbr),
                        'score': int(score) if score else None
                    }
            
            if not home_team or not away_team:
                return None
            
            if not home_team['id'] or not away_team['id']:
                logger.warning(f"Missing team IDs for {home_team['abbreviation']} vs {away_team['abbreviation']}")
                return None
            
            # Get game status
            status = competition.get('status', {})
            status_type = status.get('type', {})
            is_completed = status_type.get('completed', False)
            
            # Get game type
            season_type = espn_event.get('season', {}).get('type', 2)
            game_type_map = {1: 'preseason', 2: 'regular', 3: 'postseason'}
            game_type = game_type_map.get(season_type, 'regular')
            
            return {
                'season': season,
                'week': week,
                'game_date': game_date.isoformat(),
                'home_team_id': home_team['id'],
                'away_team_id': away_team['id'],
                'home_score': home_team['score'],
                'away_score': away_team['score'],
                'is_final': is_completed,
                'game_type': game_type,
                'external_id': f"espn_{espn_game_id}" if espn_game_id else None
            }
        
        except Exception as e:
            logger.error(f"Failed to transform game: {e}")
            return None
    
    def fetch_and_post(self, season: int = 2025, weeks: Optional[List[int]] = None,
                       season_type: int = 2) -> Dict[str, Any]:
        """
        Fetch NFL games from ESPN and post to API.
        
        Args:
            season: Season year
            weeks: List of week numbers to fetch. If None, fetches current week.
            season_type: 1=preseason, 2=regular season, 3=postseason
        
        Returns:
            API response with insert/update counts
        """
        logger.info(f"Starting NFL games fetch for season {season}")
        
        # Build team mapping
        self.build_team_map()
        
        # Default to weeks 1-18 for regular season if not specified
        if weeks is None:
            weeks = list(range(1, 19))
        
        all_games = []
        
        for week in weeks:
            try:
                logger.info(f"Fetching games for week {week}")
                scoreboard = self.espn_client.get_scoreboard(
                    season=season,
                    week=week,
                    season_type=season_type
                )
                
                events = scoreboard.get('events', [])
                
                for event in events:
                    game = self.transform_game(event, season, week)
                    if game:
                        all_games.append(game)
                
                logger.info(f"Fetched {len(events)} games for week {week}")
            
            except Exception as e:
                logger.error(f"Failed to fetch games for week {week}: {e}")
        
        logger.info(f"Transformed {len(all_games)} total games")
        
        # Post to API
        if all_games:
            result = self.api_client.post_nfl_games(all_games)
            logger.info(f"Posted games: {result}")
            return result
        else:
            logger.warning("No games to post")
            return {"success": False, "message": "No games fetched"}
