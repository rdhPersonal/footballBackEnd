# Fantasy Football Database - Entity Relationship Diagram

## Overview
This database supports a single fantasy football league with comprehensive tracking of NFL data, fantasy league operations, and historical roster/transaction data.

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NFL DATA LAYER                                 │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  nfl_teams   │
    │──────────────│
    │ id (PK)      │
    │ team_code    │
    │ team_name    │
    │ city         │
    │ conference   │
    │ division     │
    └──────┬───────┘
           │
           │ 1:N
           │
    ┌──────▼───────┐
    │   players    │
    │──────────────│
    │ id (PK)      │
    │ external_id  │
    │ first_name   │
    │ last_name    │
    │ position     │
    │ nfl_team_id  │◄────┐
    │ jersey_number│     │
    │ status       │     │
    └──────┬───────┘     │
           │             │
           │ 1:N         │
           │             │
    ┌──────▼─────────────┴──┐
    │  player_game_stats    │
    │───────────────────────│
    │ id (PK)               │
    │ player_id (FK)        │
    │ nfl_game_id (FK)      │
    │ passing_attempts      │
    │ passing_yards         │
    │ passing_touchdowns    │
    │ rushing_yards         │
    │ receiving_yards       │
    │ ... (all stats)       │
    └───────────┬───────────┘
                │
                │ N:1
                │
         ┌──────▼──────┐
         │  nfl_games  │
         │─────────────│
         │ id (PK)     │
         │ season      │
         │ week        │
         │ game_date   │
         │ home_team_id│──┐
         │ away_team_id│──┼──► References nfl_teams
         │ home_score  │  │
         │ away_score  │──┘
         │ is_final    │
         └─────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                        FANTASY LEAGUE LAYER                              │
└─────────────────────────────────────────────────────────────────────────┘

         ┌──────────────┐
         │    league    │
         │──────────────│
         │ id (PK)      │
         │ name         │
         │ season       │
         │ cbs_league_id│
         │ num_teams    │
         └──────┬───────┘
                │
                │ 1:N
                │
         ┌──────▼──────────┐
         │ fantasy_teams   │
         │─────────────────│
         │ id (PK)         │
         │ league_id (FK)  │
         │ team_name       │
         │ owner_name      │
         │ cbs_team_id     │
         └──┬───────┬──────┘
            │       │
            │       │ 1:N
            │       │
            │   ┌───▼──────────────┐
            │   │  draft_picks     │
            │   │──────────────────│
            │   │ id (PK)          │
            │   │ league_id (FK)   │
            │   │ fantasy_team_id  │
            │   │ player_id (FK)   │──► References players
            │   │ round            │
            │   │ pick_number      │
            │   │ pick_in_round    │
            │   └──────────────────┘
            │
            │ 1:N
            │
         ┌──▼──────────────┐
         │ roster_entries  │
         │─────────────────│
         │ id (PK)         │
         │ fantasy_team_id │
         │ player_id (FK)  │──► References players
         │ acquired_date   │
         │ released_date   │
         │ acquisition_type│
         └─────────────────┘
            │
            │ Related to
            │
         ┌──▼──────────────┐
         │  transactions   │
         │─────────────────│
         │ id (PK)         │
         │ league_id (FK)  │
         │ transaction_type│
         │ transaction_date│
         │ fantasy_team_id │
         │ player_id (FK)  │──► References players
         │ related_trans_id│
         └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                      WEEKLY MATCHUP LAYER                                │
└─────────────────────────────────────────────────────────────────────────┘

         ┌──────────────┐
         │   matchups   │
         │──────────────│
         │ id (PK)      │
         │ league_id    │
         │ season       │
         │ week         │
         │ home_team_id │──┐
         │ away_team_id │──┼──► References fantasy_teams
         │ home_score   │  │
         │ away_score   │──┘
         │ is_playoff   │
         └──────┬───────┘
                │
                │ 1:N
                │
         ┌──────▼──────────┐
         │    lineups      │
         │─────────────────│
         │ id (PK)         │
         │ matchup_id (FK) │
         │ fantasy_team_id │
         │ player_id (FK)  │──► References players
         │ lineup_slot     │
         │ is_starter      │
         └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                      FANTASY SCORING LAYER                               │
└─────────────────────────────────────────────────────────────────────────┘

         ┌─────────────────────┐
         │ player_fantasy_scores│
         │─────────────────────│
         │ id (PK)             │
         │ player_id (FK)      │──► References players
         │ nfl_game_id (FK)    │──► References nfl_games
         │ fantasy_points      │
         └─────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         USER/AUTH LAYER                                  │
└─────────────────────────────────────────────────────────────────────────┘

         ┌──────────────────┐
         │      users       │
         │──────────────────│
         │ id (PK)          │
         │ email            │
         │ password_hash    │
         │ cognito_sub      │
         │ fantasy_team_id  │──► References fantasy_teams
         │ is_admin         │
         └──────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                      SCRAPING METADATA                                   │
└─────────────────────────────────────────────────────────────────────────┘

         ┌──────────────────┐
         │   scrape_jobs    │
         │──────────────────│
         │ id (PK)          │
         │ job_type         │
         │ status           │
         │ started_at       │
         │ completed_at     │
         │ error_message    │
         │ metadata (JSONB) │
         └──────────────────┘
```

## Key Relationships

### NFL Data Flow
1. **nfl_teams** → **players** (1:N) - Each team has many players
2. **nfl_teams** → **nfl_games** (1:N) - Each team plays in many games
3. **players** → **player_game_stats** (1:N) - Each player has stats for each game
4. **nfl_games** → **player_game_stats** (1:N) - Each game has stats for many players

### Fantasy League Flow
1. **league** → **fantasy_teams** (1:N) - One league has many teams
2. **fantasy_teams** → **draft_picks** (1:N) - Each team makes many draft picks
3. **fantasy_teams** → **roster_entries** (1:N) - Each team has roster history
4. **fantasy_teams** → **transactions** (1:N) - Each team makes many transactions
5. **players** → **draft_picks/roster_entries/transactions** (1:N) - Players are referenced across fantasy operations

### Matchup Flow
1. **fantasy_teams** → **matchups** (1:N) - Teams play in weekly matchups
2. **matchups** → **lineups** (1:N) - Each matchup has lineups for both teams
3. **players** → **lineups** (1:N) - Players are assigned to lineup slots

### Scoring Flow
1. **players** + **nfl_games** → **player_fantasy_scores** - Fantasy points calculated per player per game
2. **player_game_stats** is the source data for calculating **player_fantasy_scores**

### User Flow
1. **users** → **fantasy_teams** (N:1) - Users can be linked to their fantasy team

## Data Integrity Features

- **Unique Constraints**: Prevent duplicate data (e.g., same player in same game, same matchup)
- **Foreign Keys**: Ensure referential integrity across all relationships
- **Indexes**: Optimize common queries (by week, by team, by player)
- **Triggers**: Auto-update `updated_at` timestamps on all tables
- **Audit Trail**: All tables have `created_at` and most have `updated_at`

## Query Patterns

### Common Queries Supported:
- Get all players on a fantasy team for a specific week (via roster_entries)
- Get fantasy scores for a team in a specific matchup (via lineups + player_fantasy_scores)
- Track roster changes over time (via roster_entries with date ranges)
- View complete draft history (via draft_picks)
- Calculate weekly fantasy team scores (join lineups + player_fantasy_scores)
- Get NFL player stats for any game (via player_game_stats)
- Track all transactions for a team (via transactions)

## Scraping Integration

The **scrape_jobs** table tracks all data ingestion operations:
- CBS Sportsline scraping (rosters, scores, draft, transactions)
- ESPN API calls (NFL stats, schedules)
- Job status tracking for monitoring and debugging
