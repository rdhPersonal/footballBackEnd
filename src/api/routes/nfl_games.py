"""
NFL Games API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from src.api.models import (
    NFLGame, NFLGameCreate, BulkNFLGamesCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/nfl/games", tags=["NFL Games"])


@router.get("", response_model=List[NFLGame])
def get_games(
    season: int = Query(2025),
    week: Optional[int] = Query(None, ge=1, le=22),
    team_id: Optional[int] = Query(None, description="Get games for specific team (home or away)"),
    is_final: Optional[bool] = Query(None),
    game_type: str = Query("regular"),
    limit: int = Query(100, ge=1, le=500)
):
    """
    Get NFL games with optional filtering.
    
    - **season**: Filter by season year
    - **week**: Filter by week number
    - **team_id**: Filter by team (home or away)
    - **is_final**: Filter by game status
    - **game_type**: Filter by game type (regular, playoff, championship)
    - **limit**: Maximum number of games to return
    """
    query = "SELECT * FROM nfl_games WHERE season = %s"
    params = [season]
    
    if week is not None:
        query += " AND week = %s"
        params.append(week)
    
    if team_id is not None:
        query += " AND (home_team_id = %s OR away_team_id = %s)"
        params.extend([team_id, team_id])
    
    if is_final is not None:
        query += " AND is_final = %s"
        params.append(is_final)
    
    if game_type:
        query += " AND game_type = %s"
        params.append(game_type)
    
    query += " ORDER BY game_date, week LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        games = cursor.fetchall()
    
    return games


@router.get("/{game_id}", response_model=NFLGame)
def get_game(game_id: int):
    """Get a specific NFL game by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM nfl_games WHERE id = %s", (game_id,))
        game = cursor.fetchone()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return game


@router.get("/week/{season}/{week}", response_model=List[NFLGame])
def get_games_by_week(season: int, week: int):
    """Get all games for a specific week."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(
            "SELECT * FROM nfl_games WHERE season = %s AND week = %s ORDER BY game_date",
            (season, week)
        )
        games = cursor.fetchall()
    
    return games


@router.post("", response_model=BulkCreateResponse)
def create_games(bulk_data: BulkNFLGamesCreate):
    """
    Bulk insert or update NFL games.
    
    Uses upsert logic based on season, week, home_team_id, away_team_id.
    """
    if not bulk_data.games:
        raise HTTPException(status_code=400, detail="No games provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for game in bulk_data.games:
            cursor.execute("""
                INSERT INTO nfl_games (
                    season, week, game_date, home_team_id, away_team_id,
                    home_score, away_score, is_final, game_type, external_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (season, week, home_team_id, away_team_id) DO UPDATE SET
                    game_date = EXCLUDED.game_date,
                    home_score = EXCLUDED.home_score,
                    away_score = EXCLUDED.away_score,
                    is_final = EXCLUDED.is_final,
                    game_type = EXCLUDED.game_type,
                    external_id = EXCLUDED.external_id,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                game.season,
                game.week,
                game.game_date,
                game.home_team_id,
                game.away_team_id,
                game.home_score,
                game.away_score,
                game.is_final,
                game.game_type,
                game.external_id
            ))
            
            result = cursor.fetchone()
            if result['inserted']:
                inserted_count += 1
            else:
                updated_count += 1
    
    return BulkCreateResponse(
        success=True,
        inserted_count=inserted_count,
        updated_count=updated_count,
        message=f"Processed {len(bulk_data.games)} games: {inserted_count} inserted, {updated_count} updated"
    )


@router.patch("/{game_id}/score")
def update_game_score(
    game_id: int,
    home_score: int,
    away_score: int,
    is_final: bool = False
):
    """Update the score for a game."""
    with get_db_cursor() as cursor:
        cursor.execute("""
            UPDATE nfl_games
            SET home_score = %s, away_score = %s, is_final = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id
        """, (home_score, away_score, is_final, game_id))
        
        updated = cursor.fetchone()
    
    if not updated:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return {"success": True, "message": f"Game {game_id} score updated"}


@router.delete("/{game_id}")
def delete_game(game_id: int):
    """Delete an NFL game by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM nfl_games WHERE id = %s RETURNING id", (game_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return {"success": True, "message": f"Game {game_id} deleted"}
