# Deployed API Information

## API Endpoints

**Base URL**: `https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev`

**API Documentation**: `https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/docs`

## Quick Test Commands

### Health Check
```bash
curl https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/health
```

### NFL Teams

**Get all teams:**
```bash
curl https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/teams
```

**Get team by code:**
```bash
curl https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/teams/code/KC
```

**Create/Update teams (bulk upsert):**
```bash
curl -X POST https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/teams \
  -H "Content-Type: application/json" \
  -d '{
    "teams": [
      {
        "team_code": "KC",
        "team_name": "Chiefs",
        "city": "Kansas City",
        "conference": "AFC",
        "division": "West"
      }
    ]
  }'
```

### NFL Players

**Get all players:**
```bash
curl https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/players
```

**Create/Update players:**
```bash
curl -X POST https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/players \
  -H "Content-Type: application/json" \
  -d '{
    "players": [
      {
        "external_id": "espn_12345",
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

### NFL Games

**Get all games:**
```bash
curl https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/games
```

**Create/Update games:**
```bash
curl -X POST https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/games \
  -H "Content-Type: application/json" \
  -d '{
    "games": [
      {
        "external_id": "espn_game_401547417",
        "season": 2025,
        "week": 1,
        "game_date": "2025-09-05",
        "home_team_id": 1,
        "away_team_id": 3,
        "home_score": 24,
        "away_score": 21,
        "status": "final"
      }
    ]
  }'
```

### NFL Player Stats

**Get all stats:**
```bash
curl https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/stats
```

**Create/Update stats:**
```bash
curl -X POST https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/nfl/stats \
  -H "Content-Type: application/json" \
  -d '{
    "stats": [
      {
        "player_id": 1,
        "game_id": 1,
        "passing_yards": 320,
        "passing_tds": 3,
        "interceptions": 0,
        "rushing_yards": 15,
        "rushing_tds": 0,
        "receptions": 0,
        "receiving_yards": 0,
        "receiving_tds": 0,
        "fumbles_lost": 0
      }
    ]
  }'
```

## Infrastructure Details

- **Lambda Function**: `fantasy-football-dev-api`
- **Runtime**: Python 3.11
- **Memory**: 512 MB
- **Timeout**: 30 seconds
- **VPC**: Private subnets with NAT Gateway for internet access
- **Database**: RDS PostgreSQL 16 (private subnet, not publicly accessible)
- **Region**: us-east-1

## Database Connection

The Lambda function connects to the RDS database using environment variables:
- DB_HOST: `fantasy-football-dev-db.cpapglostuzx.us-east-1.rds.amazonaws.com`
- DB_PORT: `5432`
- DB_NAME: `fantasy_football`
- DB_USER: `postgres`
- DB_PASSWORD: (stored in environment variable)

### Fantasy Football Leagues

**Get all leagues:**
```bash
curl https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/leagues
```

**Create/Update leagues:**
```bash
curl -X POST https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/leagues \
  -H "Content-Type: application/json" \
  -d '{
    "leagues": [{
      "name": "My Fantasy League",
      "season": 2025,
      "espn_league_id": "12345",
      "num_teams": 10,
      "playoff_start_week": 15,
      "championship_week": 17
    }]
  }'
```

### Fantasy Teams

**Get all teams:**
```bash
curl "https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/teams?league_id=1"
```

**Create/Update teams:**
```bash
curl -X POST https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/teams \
  -H "Content-Type: application/json" \
  -d '{
    "teams": [{
      "league_id": 1,
      "team_name": "The Champions",
      "owner_name": "Rick Harwood",
      "espn_team_id": "team_001"
    }]
  }'
```

### Draft Picks

**Get draft picks:**
```bash
curl "https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/draft?league_id=1"
```

**Create draft picks:**
```bash
curl -X POST https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/draft \
  -H "Content-Type: application/json" \
  -d '{
    "picks": [{
      "league_id": 1,
      "fantasy_team_id": 1,
      "player_id": 1,
      "round": 1,
      "pick_number": 1,
      "pick_in_round": 1,
      "draft_date": "2025-09-01T19:00:00Z"
    }]
  }'
```

### Rosters

**Get roster entries:**
```bash
curl "https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/rosters?fantasy_team_id=1"
```

### Transactions

**Get transactions:**
```bash
curl "https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/transactions?league_id=1"
```

### Matchups

**Get matchups:**
```bash
curl "https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/matchups?league_id=1&week=1"
```

**Create matchups:**
```bash
curl -X POST https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/matchups \
  -H "Content-Type: application/json" \
  -d '{
    "matchups": [{
      "league_id": 1,
      "season": 2025,
      "week": 1,
      "home_team_id": 1,
      "away_team_id": 2,
      "home_score": 125.5,
      "away_score": 118.2,
      "is_playoff": false
    }]
  }'
```

### Lineups

**Get lineups:**
```bash
curl "https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/lineups?matchup_id=1"
```

### Fantasy Scores

**Get fantasy scores:**
```bash
curl "https://3nvg70rdej.execute-api.us-east-1.amazonaws.com/dev/api/fantasy/scores?player_id=1"
```

## Next Steps

1. Build client tooling to fetch ESPN NFL data and POST to NFL endpoints
2. Build client tooling to fetch ESPN Fantasy League data and POST to Fantasy endpoints
3. Implement authentication/authorization
4. Add rate limiting and monitoring
