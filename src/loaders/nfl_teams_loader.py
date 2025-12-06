"""
Load NFL teams data from ESPN API.
"""
import requests
import logging
from typing import List, Dict

from src.config import ESPN_API_BASE_URL
from src.database import get_db_cursor

logger = logging.getLogger(__name__)


class NFLTeamsLoader:
    """Loader for NFL teams data."""
    
    def __init__(self):
        self.api_url = f"{ESPN_API_BASE_URL}/teams"
    
    def fetch_teams(self) -> List[Dict]:
        """
        Fetch all NFL teams from ESPN API.
        
        Returns:
            List of team dictionaries
        """
        try:
            logger.info("Fetching NFL teams from ESPN API...")
            response = requests.get(self.api_url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            teams = data.get('sports', [{}])[0].get('leagues', [{}])[0].get('teams', [])
            
            logger.info(f"Fetched {len(teams)} NFL teams")
            return teams
        
        except requests.RequestException as e:
            logger.error(f"Error fetching NFL teams: {e}")
            raise
    
    def parse_team(self, team_data: Dict) -> Dict:
        """
        Parse team data from ESPN API format.
        
        Args:
            team_data: Raw team data from API
            
        Returns:
            Parsed team dictionary
        """
        team = team_data.get('team', {})
        
        return {
            'team_code': team.get('abbreviation'),
            'team_name': team.get('displayName'),
            'city': team.get('location'),
            'conference': self._get_conference(team),
            'division': self._get_division(team)
        }
    
    def _get_conference(self, team: Dict) -> str:
        """Extract conference from team data."""
        # ESPN groups can contain conference info
        groups = team.get('groups', {})
        if groups:
            parent = groups.get('parent', {})
            if parent:
                name = parent.get('name', '')
                if 'AFC' in name or 'American' in name:
                    return 'AFC'
                elif 'NFC' in name or 'National' in name:
                    return 'NFC'
        
        # Fallback: determine by team abbreviation (hardcoded mapping)
        afc_teams = ['BUF', 'MIA', 'NE', 'NYJ', 'BAL', 'CIN', 'CLE', 'PIT',
                     'HOU', 'IND', 'JAX', 'TEN', 'DEN', 'KC', 'LV', 'LAC']
        
        return 'AFC' if team.get('abbreviation') in afc_teams else 'NFC'
    
    def _get_division(self, team: Dict) -> str:
        """Extract division from team data."""
        groups = team.get('groups', {})
        if groups:
            name = groups.get('name', '')
            for division in ['North', 'South', 'East', 'West']:
                if division in name:
                    return division
        
        # Fallback: hardcoded division mapping
        division_map = {
            'BUF': 'East', 'MIA': 'East', 'NE': 'East', 'NYJ': 'East',
            'BAL': 'North', 'CIN': 'North', 'CLE': 'North', 'PIT': 'North',
            'HOU': 'South', 'IND': 'South', 'JAX': 'South', 'TEN': 'South',
            'DEN': 'West', 'KC': 'West', 'LV': 'West', 'LAC': 'West',
            'DAL': 'East', 'NYG': 'East', 'PHI': 'East', 'WAS': 'East',
            'CHI': 'North', 'DET': 'North', 'GB': 'North', 'MIN': 'North',
            'ATL': 'South', 'CAR': 'South', 'NO': 'South', 'TB': 'South',
            'ARI': 'West', 'LAR': 'West', 'SF': 'West', 'SEA': 'West'
        }
        
        return division_map.get(team.get('abbreviation'), 'Unknown')
    
    def load_teams(self) -> int:
        """
        Load NFL teams into the database.
        
        Returns:
            Number of teams loaded
        """
        teams_data = self.fetch_teams()
        
        if not teams_data:
            logger.warning("No teams data to load")
            return 0
        
        teams_to_insert = []
        for team_data in teams_data:
            try:
                parsed_team = self.parse_team(team_data)
                teams_to_insert.append(parsed_team)
            except Exception as e:
                logger.error(f"Error parsing team: {e}")
                continue
        
        # Insert teams into database
        with get_db_cursor() as cursor:
            inserted_count = 0
            for team in teams_to_insert:
                try:
                    cursor.execute("""
                        INSERT INTO nfl_teams (team_code, team_name, city, conference, division)
                        VALUES (%(team_code)s, %(team_name)s, %(city)s, %(conference)s, %(division)s)
                        ON CONFLICT (team_code) DO UPDATE SET
                            team_name = EXCLUDED.team_name,
                            city = EXCLUDED.city,
                            conference = EXCLUDED.conference,
                            division = EXCLUDED.division,
                            updated_at = CURRENT_TIMESTAMP
                    """, team)
                    inserted_count += 1
                except Exception as e:
                    logger.error(f"Error inserting team {team.get('team_code')}: {e}")
                    continue
        
        logger.info(f"Successfully loaded {inserted_count} NFL teams")
        return inserted_count


def main():
    """Main function to load NFL teams."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    loader = NFLTeamsLoader()
    count = loader.load_teams()
    print(f"Loaded {count} NFL teams")


if __name__ == '__main__':
    main()
