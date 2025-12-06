"""
Draft Picks API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    DraftPick, DraftPickCreate, BulkDraftPicksCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/fantasy/draft", tags=["Draft Picks"])


@router.get("", response_model=List[DraftPick])
def get_draft_picks(
    league_id: Optional[int] = Query(None),
    fantasy_team_id: Optional[int] = Query(None),
    round_number: Optional[int] = Query(None),
    limit: int = Query(500, ge=1, le=500)
):
    """Get all draft picks with optional filtering."""
    query = "SELECT * FROM draft_picks WHERE 1=1"
    params = []
    
    if league_id:
        query += " AND league_id = %s"
        params.append(league_id)
    
    if fantasy_team_id:
        query += " AND fantasy_team_id = %s"
        params.append(fantasy_team_id)
    
    if round_number:
        query += " AND round = %s"
        params.append(round_number)
    
    query += " ORDER BY pick_number LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        picks = cursor.fetchall()
    
    return picks


@router.get("/{pick_id}", response_model=DraftPick)
def get_draft_pick(pick_id: int):
    """Get a specific draft pick by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM draft_picks WHERE id = %s", (pick_id,))
        pick = cursor.fetchone()
    
    if not pick:
        raise HTTPException(status_code=404, detail="Draft pick not found")
    
    return pick


@router.post("", response_model=BulkCreateResponse)
def create_draft_picks(bulk_data: BulkDraftPicksCreate):
    """Bulk insert or update draft picks."""
    if not bulk_data.picks:
        raise HTTPException(status_code=400, detail="No draft picks provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for pick in bulk_data.picks:
            cursor.execute("""
                INSERT INTO draft_picks (
                    league_id, fantasy_team_id, player_id,
                    round, pick_number, pick_in_round, draft_date
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (league_id, pick_number) DO UPDATE SET
                    fantasy_team_id = EXCLUDED.fantasy_team_id,
                    player_id = EXCLUDED.player_id,
                    round = EXCLUDED.round,
                    pick_in_round = EXCLUDED.pick_in_round,
                    draft_date = EXCLUDED.draft_date
                RETURNING (xmax = 0) AS inserted
            """, (
                pick.league_id,
                pick.fantasy_team_id,
                pick.player_id,
                pick.round,
                pick.pick_number,
                pick.pick_in_round,
                pick.draft_date
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
        message=f"Processed {len(bulk_data.picks)} draft picks: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{pick_id}")
def delete_draft_pick(pick_id: int):
    """Delete a draft pick by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM draft_picks WHERE id = %s RETURNING id", (pick_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Draft pick not found")
    
    return {"success": True, "message": f"Draft pick {pick_id} deleted"}
