"""
Matchups API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    Matchup, MatchupCreate, BulkMatchupsCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/fantasy/matchups", tags=["Matchups"])


@router.get("", response_model=List[Matchup])
def get_matchups(
    league_id: Optional[int] = Query(None),
    week: Optional[int] = Query(None),
    is_playoff: Optional[bool] = Query(None),
    limit: int = Query(500, ge=1, le=500)
):
    """Get all matchups with optional filtering."""
    query = "SELECT * FROM matchups WHERE 1=1"
    params = []
    
    if league_id:
        query += " AND league_id = %s"
        params.append(league_id)
    
    if week:
        query += " AND week = %s"
        params.append(week)
    
    if is_playoff is not None:
        query += " AND is_playoff = %s"
        params.append(is_playoff)
    
    query += " ORDER BY week, id LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        matchups = cursor.fetchall()
    
    return matchups


@router.get("/{matchup_id}", response_model=Matchup)
def get_matchup(matchup_id: int):
    """Get a specific matchup by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM matchups WHERE id = %s", (matchup_id,))
        matchup = cursor.fetchone()
    
    if not matchup:
        raise HTTPException(status_code=404, detail="Matchup not found")
    
    return matchup


@router.post("", response_model=BulkCreateResponse)
def create_matchups(bulk_data: BulkMatchupsCreate):
    """Bulk insert or update matchups."""
    if not bulk_data.matchups:
        raise HTTPException(status_code=400, detail="No matchups provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for matchup in bulk_data.matchups:
            cursor.execute("""
                INSERT INTO matchups (
                    league_id, season, week, home_team_id, away_team_id,
                    home_score, away_score, is_playoff
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (league_id, season, week, home_team_id) DO UPDATE SET
                    away_team_id = EXCLUDED.away_team_id,
                    home_score = EXCLUDED.home_score,
                    away_score = EXCLUDED.away_score,
                    is_playoff = EXCLUDED.is_playoff,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                matchup.league_id,
                matchup.season,
                matchup.week,
                matchup.home_team_id,
                matchup.away_team_id,
                matchup.home_score,
                matchup.away_score,
                matchup.is_playoff
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
        message=f"Processed {len(bulk_data.matchups)} matchups: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{matchup_id}")
def delete_matchup(matchup_id: int):
    """Delete a matchup by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM matchups WHERE id = %s RETURNING id", (matchup_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Matchup not found")
    
    return {"success": True, "message": f"Matchup {matchup_id} deleted"}
