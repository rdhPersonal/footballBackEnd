## Fantasy Football CRUD API

FastAPI-based REST API for managing NFL and Fantasy Football data.

## Features

- ✅ Full CRUD operations for NFL teams and players
- ✅ Bulk insert/update with upsert logic
- ✅ Query filtering and pagination
- ✅ Auto-generated OpenAPI documentation
- ✅ Type validation with Pydantic
- ✅ Ready for AWS Lambda deployment

## Local Development

### Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with database credentials
```

### Run Locally

```bash
python scripts/run_api_local.py
```

API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### NFL Teams

**GET /api/nfl/teams**
- Get all teams with optional filtering
- Query params: `conference`, `division`, `limit`

**GET /api/nfl/teams/{team_id}**
- Get specific team by ID

**GET /api/nfl/teams/code/{team_code}**
- Get team by code (e.g., 'KC', 'SF')

**POST /api/nfl/teams**
- Bulk insert/update teams
- Body: `{"teams": [...]}`
- Uses upsert logic on `team_code`

**DELETE /api/nfl/teams/{team_id}**
- Delete a team

### NFL Players

**GET /api/nfl/players**
- Get all players with optional filtering
- Query params: `position`, `nfl_team_id`, `status`, `limit`

**GET /api/nfl/players/{player_id}**
- Get specific player by ID

**GET /api/nfl/players/external/{external_id}**
- Get player by ESPN ID

**POST /api/nfl/players**
- Bulk insert/update players
- Body: `{"players": [...]}`
- Uses upsert logic on `external_id`

**DELETE /api/nfl/players/{player_id}**
- Delete a player

## Example Requests

### Create Teams

```bash
curl -X POST http://localhost:8000/api/nfl/teams \
  -H "Content-Type: application/json" \
  -d '{
    "teams": [
      {
        "team_code": "KC",
        "team_name": "Kansas City Chiefs",
        "city": "Kansas City",
        "conference": "AFC",
        "division": "West"
      }
    ]
  }'
```

### Get Teams

```bash
# All teams
curl http://localhost:8000/api/nfl/teams

# AFC teams only
curl http://localhost:8000/api/nfl/teams?conference=AFC

# Specific team
curl http://localhost:8000/api/nfl/teams/code/KC
```

### Create Players

```bash
curl -X POST http://localhost:8000/api/nfl/players \
  -H "Content-Type: application/json" \
  -d '{
    "players": [
      {
        "external_id": "3139477",
        "first_name": "Patrick",
        "last_name": "Mahomes",
        "position": "QB",
        "nfl_team_id": 1,
        "jersey_number": 15,
        "status": "active"
      }
    ]
  }'
```

## AWS Lambda Deployment

The API uses Mangum to run in AWS Lambda. Deploy with:

```bash
# Package for Lambda
cd src
zip -r ../api.zip .

# Upload to Lambda (via Terraform or AWS CLI)
```

### NFL Games

**GET /api/nfl/games**
- Get all games with optional filtering
- Query params: `season`, `week`, `team_id`, `is_final`, `game_type`, `limit`

**GET /api/nfl/games/{game_id}**
- Get specific game by ID

**GET /api/nfl/games/week/{season}/{week}**
- Get all games for a specific week

**POST /api/nfl/games**
- Bulk insert/update games
- Body: `{"games": [...]}`
- Uses upsert logic on `season, week, home_team_id, away_team_id`

**PATCH /api/nfl/games/{game_id}/score**
- Update game score
- Query params: `home_score`, `away_score`, `is_final`

**DELETE /api/nfl/games/{game_id}**
- Delete a game

### NFL Player Stats

**GET /api/nfl/stats**
- Get player game stats with optional filtering
- Query params: `player_id`, `nfl_game_id`, `limit`

**GET /api/nfl/stats/{stat_id}**
- Get specific stat record by ID

**GET /api/nfl/stats/player/{player_id}**
- Get all game stats for a player

**GET /api/nfl/stats/game/{game_id}**
- Get all player stats for a game

**GET /api/nfl/stats/player/{player_id}/season/{season}**
- Get all stats for a player in a season

**POST /api/nfl/stats**
- Bulk insert/update player stats
- Body: `{"stats": [...]}`
- Uses upsert logic on `player_id, nfl_game_id`

**DELETE /api/nfl/stats/{stat_id}**
- Delete a stat record

## Example Requests

### Create Games

```bash
curl -X POST http://localhost:8000/api/nfl/games \
  -H "Content-Type: application/json" \
  -d '{
    "games": [
      {
        "season": 2025,
        "week": 1,
        "game_date": "2025-09-07T20:00:00",
        "home_team_id": 1,
        "away_team_id": 2,
        "home_score": 24,
        "away_score": 17,
        "is_final": true,
        "game_type": "regular"
      }
    ]
  }'
```

### Create Player Stats

```bash
curl -X POST http://localhost:8000/api/nfl/stats \
  -H "Content-Type: application/json" \
  -d '{
    "stats": [
      {
        "player_id": 1,
        "nfl_game_id": 1,
        "passing_attempts": 35,
        "passing_completions": 28,
        "passing_yards": 312,
        "passing_touchdowns": 3,
        "interceptions": 0
      }
    ]
  }'
```

## Next Steps

1. ✅ NFL teams endpoints - COMPLETE
2. ✅ NFL players endpoints - COMPLETE
3. ✅ NFL games endpoints - COMPLETE
4. ✅ NFL stats endpoints - COMPLETE
5. Add fantasy league endpoints
6. Deploy to AWS Lambda
7. Configure API Gateway
