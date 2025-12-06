# ESPN Data Fetcher

## Overview

The ESPN Data Fetcher is a Python-based tool that runs on your desktop to fetch NFL data from ESPN's public APIs and load it into your Fantasy Football AWS API.

## Architecture

```
ESPN APIs → ESPN Client → Data Transformers → AWS API Client → Lambda → RDS
```

## Components

### 1. ESPN Client (`scripts/espn_fetchers/espn_client.py`)
- Fetches data from ESPN's public APIs
- No authentication required for NFL data
- Endpoints used:
  - `/teams` - All NFL teams
  - `/scoreboard` - Games/schedule by week
  - `/teams/{id}/roster` - Team rosters
  - `/summary` - Game details with player stats

### 2. API Client (`scripts/espn_fetchers/api_client.py`)
- Posts transformed data to your AWS API
- Handles bulk operations
- Includes retry logic and error handling

### 3. Fetchers
- **NFLTeamsFetcher** - Fetches and transforms NFL teams
- **NFLPlayersFetcher** - Fetches rosters for all teams
- **NFLGamesFetcher** - Fetches games/schedule by week
- **NFLStatsFetcher** - Fetches player game statistics (requires schema update)

### 4. Main Orchestrator (`scripts/load_nfl_data.py`)
- Command-line interface
- Runs fetchers in correct order
- Logging to console and file

## Usage

### Fetch NFL Teams
```bash
python scripts/load_nfl_data.py --teams
```

**Result**: Successfully fetched and loaded 32 NFL teams

### Fetch NFL Players
```bash
python scripts/load_nfl_data.py --players
```

**Status**: Fetcher works (2,577 players fetched), but requires database schema fix:
- Need to add UNIQUE constraint on `players.external_id`
- Current schema has INDEX but not UNIQUE constraint
- API upsert logic requires UNIQUE constraint for ON CONFLICT

### Fetch NFL Games
```bash
python scripts/load_nfl_data.py --games --season 2025 --weeks 1-5
```

### Fetch All Data
```bash
python scripts/load_nfl_data.py --all --season 2025
```

### Advanced Options
```bash
# Specific weeks
python scripts/load_nfl_data.py --games --weeks "1,3,5"
python scripts/load_nfl_data.py --games --weeks "1-3,5,7-9"

# Debug logging
python scripts/load_nfl_data.py --all --debug

# Custom API URL
python scripts/load_nfl_data.py --teams --api-url https://your-api.com/dev
```

## Current Status

✅ **Working**:
- ESPN Client - Successfully fetches from ESPN APIs
- NFL Teams Fetcher - 32 teams loaded
- NFL Games Fetcher - Ready to use
- API Client - Successfully posts to AWS API

⚠️ **Needs Fix**:
- NFL Players - Requires database schema update:
  ```sql
  ALTER TABLE players ADD CONSTRAINT players_external_id_unique UNIQUE (external_id);
  ```

⚠️ **Needs Enhancement**:
- NFL Stats Fetcher - Requires `external_id` column in `nfl_games` table to store ESPN game IDs

## Logs

All operations are logged to:
- Console (stdout)
- File: `nfl_data_load.log`

## Next Steps

1. **Fix Players Table**:
   - Add UNIQUE constraint on `players.external_id`
   - Re-run players fetcher

2. **Load Games**:
   - Run games fetcher for desired weeks
   - Add `external_id` to `nfl_games` table for stats fetching

3. **Build Fantasy League Fetcher**:
   - Similar pattern for ESPN Fantasy League data
   - Fetch leagues, teams, rosters, matchups, etc.

## Data Flow Example

```
1. ESPN API: GET /teams
   ↓
2. Transform: ESPN format → API format
   {
     "abbreviation": "KC",
     "location": "Kansas City",
     "name": "Chiefs"
   }
   →
   {
     "team_code": "KC",
     "city": "Kansas City",
     "team_name": "Chiefs",
     "conference": "AFC",
     "division": "West"
   }
   ↓
3. AWS API: POST /api/nfl/teams
   ↓
4. Lambda: Upsert to RDS
   ↓
5. Result: 30 inserted, 2 updated
```

## Error Handling

- Network errors: Logged and skipped
- Transform errors: Logged, item skipped, batch continues
- API errors: Logged with full response
- Database errors: Returned in API response

## Performance

- Teams: ~2 seconds (32 teams)
- Players: ~2 minutes (2,577 players, 32 API calls)
- Games: ~30 seconds per week
- Batch size: 100 items per API call
