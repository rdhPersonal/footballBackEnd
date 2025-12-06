"""
Player Fantasy Scores API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    PlayerFantasyScore, PlayerFantasyScoreCreate, BulkPlayerFantasyScoresCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/fantasy/scores", tags=["Fantasy Scores"])


@router.get("", response_model=List[PlayerFantasyScore])
def get_fantasy_scores(
    player_id: Optional[int] = Query(None),
    nfl_game_id: Optional[int] = Query(None),
    limit: int = Query(500, ge=1, le=500)
):
    """Get all player fantasy scores with optional filtering."""
    query = "SELECT * FROM player_fantasy_scores WHERE 1=1"
    params = []
    
    if player_id:
        query += " AND player_id = %s"
        params.append(player_id)
    
    if nfl_game_id:
        query += " AND nfl_game_id = %s"
        params.append(nfl_game_id)
    
    query += " ORDER BY fantasy_points DESC LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        scores = cursor.fetchall()
    
    return scores


@router.get("/{score_id}", response_model=PlayerFantasyScore)
def get_fantasy_score(score_id: int):
    """Get a specific fantasy score by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM player_fantasy_scores WHERE id = %s", (score_id,))
        score = cursor.fetchone()
    
    if not score:
        raise HTTPException(status_code=404, detail="Fantasy score not found")
    
    return score


@router.post("", response_model=BulkCreateResponse)
def create_fantasy_scores(bulk_data: BulkPlayerFantasyScoresCreate):
    """Bulk insert or update player fantasy scores."""
    if not bulk_data.scores:
        raise HTTPException(status_code=400, detail="No fantasy scores provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for score in bulk_data.scores:
            cursor.execute("""
                INSERT INTO player_fantasy_scores (
                    player_id, nfl_game_id, fantasy_points
                )
                VALUES (%s, %s, %s)
                ON CONFLICT (player_id, nfl_game_id) DO UPDATE SET
                    fantasy_points = EXCLUDED.fantasy_points,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                score.player_id,
                score.nfl_game_id,
                score.fantasy_points
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
        message=f"Processed {len(bulk_data.scores)} fantasy scores: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{score_id}")
def delete_fantasy_score(score_id: int):
    """Delete a fantasy score by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM player_fantasy_scores WHERE id = %s RETURNING id", (score_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Fantasy score not found")
    
    return {"success": True, "message": f"Fantasy score {score_id} deleted"}
