# Fantasy Football API - Complete Endpoint Reference

## Base URL
- **Local**: `http://localhost:8000`
- **AWS**: TBD (after Lambda deployment)

## Documentation
- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`

---

## NFL Teams Endpoints

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/nfl/teams` | List all teams | `conference`, `division`, `limit` |
| GET | `/api/nfl/teams/{id}` | Get team by ID | - |
| GET | `/api/nfl/teams/code/{code}` | Get team by code | - |
| POST | `/api/nfl/teams` | Bulk create/update teams | - |
| DELETE | `/api/nfl/teams/{id}` | Delete team | - |

**Example POST Body:**
```json
{
  "teams": [
    {
      "team_code": "KC",
      "team_name": "Kansas City Chiefs",
      "city": "Kansas City",
      "conference": "AFC",
      "division": "West"
    }
  ]
}
```

---

## NFL Players Endpoints

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/nfl/players` | List all players | `position`, `nfl_team_id`, `status`, `limit` |
| GET | `/api/nfl/players/{id}` | Get player by ID | - |
| GET | `/api/nfl/players/external/{espn_id}` | Get player by ESPN ID | - |
| POST | `/api/nfl/players` | Bulk create/update players | - |
| DELETE | `/api/nfl/players/{id}` | Delete player | - |

**Example POST Body:**
```json
{
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
}
```

---

## NFL Games Endpoints

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/nfl/games` | List all games | `season`, `week`, `team_id`, `is_final`, `game_type`, `limit` |
| GET | `/api/nfl/games/{id}` | Get game by ID | - |
| GET | `/api/nfl/games/week/{season}/{week}` | Get games by week | - |
| POST | `/api/nfl/games` | Bulk create/update games | - |
| PATCH | `/api/nfl/games/{id}/score` | Update game score | `home_score`, `away_score`, `is_final` |
| DELETE | `/api/nfl/games/{id}` | Delete game | - |

**Example POST Body:**
```json
{
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
}
```

---

## NFL Player Stats Endpoints

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/nfl/stats` | List all stats | `player_id`, `nfl_game_id`, `limit` |
| GET | `/api/nfl/stats/{id}` | Get stat by ID | - |
| GET | `/api/nfl/stats/player/{player_id}` | Get all stats for player | `limit` |
| GET | `/api/nfl/stats/game/{game_id}` | Get all stats for game | - |
| GET | `/api/nfl/stats/player/{player_id}/season/{season}` | Get player season stats | - |
| POST | `/api/nfl/stats` | Bulk create/update stats | - |
| DELETE | `/api/nfl/stats/{id}` | Delete stat | - |

**Example POST Body:**
```json
{
  "stats": [
    {
      "player_id": 1,
      "nfl_game_id": 1,
      "passing_attempts": 35,
      "passing_completions": 28,
      "passing_yards": 312,
      "passing_touchdowns": 3,
      "interceptions": 0,
      "rushing_attempts": 2,
      "rushing_yards": 15,
      "rushing_touchdowns": 0
    }
  ]
}
```

---

## Common Response Formats

### Success Response (Bulk Operations)
```json
{
  "success": true,
  "inserted_count": 5,
  "updated_count": 2,
  "message": "Processed 7 items: 5 inserted, 2 updated"
}
```

### Error Response
```json
{
  "error": "Not Found",
  "detail": "Team not found"
}
```

---

## Query Parameter Reference

### Filtering
- `conference`: "AFC" or "NFC"
- `division`: "North", "South", "East", "West"
- `position`: "QB", "RB", "WR", "TE", "K", "DEF"
- `status`: "active", "injured", "suspended", "retired"
- `season`: Year (e.g., 2025)
- `week`: 1-22 (1-18 regular season, 19-22 playoffs)
- `game_type`: "regular", "playoff", "championship"

### Pagination
- `limit`: Maximum results to return (default varies by endpoint)

### Boolean Filters
- `is_final`: true/false (game completion status)

---

## Upsert Logic

All POST endpoints use upsert (insert or update) logic:

- **Teams**: Unique on `team_code`
- **Players**: Unique on `external_id` (if provided)
- **Games**: Unique on `season, week, home_team_id, away_team_id`
- **Stats**: Unique on `player_id, nfl_game_id`

This means you can safely re-POST data without creating duplicates.

---

## Testing

### Local Testing
```bash
# Start API
python scripts/run_api_local.py

# Test health endpoint
curl http://localhost:8000/health

# View interactive docs
open http://localhost:8000/docs
```

### Example cURL Commands
```bash
# Get all AFC teams
curl "http://localhost:8000/api/nfl/teams?conference=AFC"

# Get specific player
curl "http://localhost:8000/api/nfl/players/1"

# Get week 1 games
curl "http://localhost:8000/api/nfl/games/week/2025/1"

# Get player stats for a game
curl "http://localhost:8000/api/nfl/stats/game/1"
```
