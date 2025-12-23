"""
Pydantic models for API request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


# ============================================================================
# NFL Models
# ============================================================================

class NFLTeamBase(BaseModel):
    team_code: str = Field(..., max_length=3, description="3-letter team code (e.g., 'KC')")
    team_name: str = Field(..., max_length=100)
    city: str = Field(..., max_length=100)
    conference: str = Field(..., pattern="^(AFC|NFC)$")
    division: str = Field(..., max_length=10)


class NFLTeamCreate(NFLTeamBase):
    pass


class NFLTeam(NFLTeamBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NFLPlayerBase(BaseModel):
    external_id: Optional[str] = Field(None, max_length=50)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    position: str = Field(..., max_length=10)
    nfl_team_id: Optional[int] = None
    jersey_number: Optional[int] = None
    status: str = Field(default="active", max_length=20)


class NFLPlayerCreate(NFLPlayerBase):
    pass


class NFLPlayer(NFLPlayerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NFLGameBase(BaseModel):
    season: int = Field(default=2025)
    week: int = Field(..., ge=1, le=22)
    game_date: datetime
    home_team_id: int
    away_team_id: int
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    is_final: bool = Field(default=False)
    game_type: str = Field(default="regular", max_length=20)
    external_id: Optional[str] = Field(None, max_length=50)


class NFLGameCreate(NFLGameBase):
    pass


class NFLGame(NFLGameBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlayerGameStatsBase(BaseModel):
    player_id: int
    nfl_game_id: int
    
    # Passing
    passing_attempts: int = 0
    passing_completions: int = 0
    passing_yards: int = 0
    passing_touchdowns: int = 0
    interceptions: int = 0
    
    # Rushing
    rushing_attempts: int = 0
    rushing_yards: int = 0
    rushing_touchdowns: int = 0
    
    # Receiving
    receptions: int = 0
    receiving_yards: int = 0
    receiving_touchdowns: int = 0
    targets: int = 0
    
    # Other
    fumbles_lost: int = 0
    two_point_conversions: int = 0
    
    # Kicker
    field_goals_made: int = 0
    field_goals_attempted: int = 0
    extra_points_made: int = 0
    extra_points_attempted: int = 0
    
    # Defense
    sacks: float = 0.0
    interceptions_defense: int = 0
    fumbles_recovered: int = 0
    touchdowns_defense: int = 0
    points_allowed: int = 0


class PlayerGameStatsCreate(PlayerGameStatsBase):
    pass


class PlayerGameStats(PlayerGameStatsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Fantasy Football Models
# ============================================================================

class FantasyLeagueBase(BaseModel):
    name: str = Field(..., max_length=200)
    season: int = Field(default=2025)
    espn_league_id: Optional[str] = Field(None, max_length=100)
    num_teams: int = Field(..., ge=2, le=20)
    playoff_start_week: Optional[int] = None
    championship_week: Optional[int] = None


class FantasyLeagueCreate(FantasyLeagueBase):
    pass


class FantasyLeague(FantasyLeagueBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FantasyTeamBase(BaseModel):
    league_id: int
    team_name: str = Field(..., max_length=200)
    owner_name: str = Field(..., max_length=200)
    espn_team_id: Optional[str] = Field(None, max_length=100)


class FantasyTeamCreate(FantasyTeamBase):
    pass


class FantasyTeam(FantasyTeamBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DraftPickBase(BaseModel):
    league_id: int
    fantasy_team_id: int
    player_id: int
    round: int = Field(..., ge=1)
    pick_number: int = Field(..., ge=1)
    pick_in_round: int = Field(..., ge=1)
    draft_date: Optional[datetime] = None


class DraftPickCreate(DraftPickBase):
    pass


class DraftPick(DraftPickBase):
    id: int
    picked_at: datetime

    class Config:
        from_attributes = True


class RosterEntryBase(BaseModel):
    fantasy_team_id: int
    player_id: int
    acquired_date: date
    released_date: Optional[date] = None
    acquisition_type: Optional[str] = Field(None, max_length=20)


class RosterEntryCreate(RosterEntryBase):
    pass


class RosterEntry(RosterEntryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionBase(BaseModel):
    league_id: int
    transaction_type: str = Field(..., max_length=20)
    transaction_date: datetime
    fantasy_team_id: int
    player_id: int
    related_transaction_id: Optional[int] = None
    notes: Optional[str] = None


class TransactionCreate(TransactionBase):
    pass


class Transaction(TransactionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MatchupBase(BaseModel):
    league_id: int
    season: int = Field(default=2025)
    week: int = Field(..., ge=1, le=17)
    home_team_id: int
    away_team_id: int
    home_score: Optional[float] = None
    away_score: Optional[float] = None
    is_playoff: bool = Field(default=False)


class MatchupCreate(MatchupBase):
    pass


class Matchup(MatchupBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LineupBase(BaseModel):
    matchup_id: int
    fantasy_team_id: int
    player_id: int
    lineup_slot: str = Field(..., max_length=20)
    is_starter: bool


class LineupCreate(LineupBase):
    pass


class Lineup(LineupBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PlayerFantasyScoreBase(BaseModel):
    player_id: int
    nfl_game_id: int
    fantasy_points: float = Field(default=0.0)


class PlayerFantasyScoreCreate(PlayerFantasyScoreBase):
    pass


class PlayerFantasyScore(PlayerFantasyScoreBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Bulk Operations
# ============================================================================

class BulkNFLTeamsCreate(BaseModel):
    teams: List[NFLTeamCreate]


class BulkNFLPlayersCreate(BaseModel):
    players: List[NFLPlayerCreate]


class BulkNFLGamesCreate(BaseModel):
    games: List[NFLGameCreate]


class BulkPlayerGameStatsCreate(BaseModel):
    stats: List[PlayerGameStatsCreate]


class BulkFantasyLeaguesCreate(BaseModel):
    leagues: List[FantasyLeagueCreate]


class BulkFantasyTeamsCreate(BaseModel):
    teams: List[FantasyTeamCreate]


class BulkDraftPicksCreate(BaseModel):
    picks: List[DraftPickCreate]


class BulkRosterEntriesCreate(BaseModel):
    entries: List[RosterEntryCreate]


class BulkTransactionsCreate(BaseModel):
    transactions: List[TransactionCreate]


class BulkMatchupsCreate(BaseModel):
    matchups: List[MatchupCreate]


class BulkLineupsCreate(BaseModel):
    lineups: List[LineupCreate]


class BulkPlayerFantasyScoresCreate(BaseModel):
    scores: List[PlayerFantasyScoreCreate]


# ============================================================================
# Response Models
# ============================================================================

class BulkCreateResponse(BaseModel):
    success: bool
    inserted_count: int
    updated_count: int = 0
    message: str


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
