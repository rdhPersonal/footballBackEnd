# NFL Data Loader

This module loads NFL data from ESPN's public API into the PostgreSQL database.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database password
   ```

3. **Verify database connection:**
   The database should already be initialized with the schema from `database/schema.sql`

## Loading NFL Teams

Load all 32 NFL teams:

```bash
python scripts/load_nfl_teams.py
```

This will:
- Fetch team data from ESPN API
- Parse team information (name, city, conference, division)
- Insert/update teams in the `nfl_teams` table
- Handle duplicates with upsert logic

## Data Sources

### ESPN API Endpoints

**Teams:** `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams`
- Returns all 32 NFL teams
- Includes team names, abbreviations, locations
- Conference and division information

## Database Tables

### nfl_teams
- `id`: Primary key
- `team_code`: 3-letter abbreviation (e.g., 'KC', 'SF')
- `team_name`: Full team name (e.g., 'Kansas City Chiefs')
- `city`: Team city
- `conference`: AFC or NFC
- `division`: North, South, East, or West

## Next Steps

After loading teams, you can load:
1. **Players** - All NFL players for the season
2. **Schedule** - NFL games schedule
3. **Game Stats** - Player statistics per game

## Troubleshooting

**Connection Error:**
- Verify database is accessible (start bastion host if needed)
- Check `.env` file has correct credentials

**API Error:**
- ESPN API is public and doesn't require authentication
- Check internet connectivity
- API might be rate-limited (add delays if needed)

**Duplicate Teams:**
- The loader uses `ON CONFLICT` to handle duplicates
- Existing teams will be updated with latest data
