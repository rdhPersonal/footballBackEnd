"""
Lineups API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    Lineup, LineupCreate, BulkLineupsCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/fantasy/lineups", tags=["Lineups"])


@router.get("", response_model=List[Lineup])
def get_lineups(
    matchup_id: Optional[int] = Query(None),
    fantasy_team_id: Optional[int] = Query(None),
    limit: int = Query(500, ge=1, le=500)
):
    """Get all lineups with optional filtering."""
    query = "SELECT * FROM lineups WHERE 1=1"
    params = []
    
    if matchup_id:
        query += " AND matchup_id = %s"
        params.append(matchup_id)
    
    if fantasy_team_id:
        query += " AND fantasy_team_id = %s"
        params.append(fantasy_team_id)
    
    query += " ORDER BY matchup_id, fantasy_team_id, lineup_slot LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        lineups = cursor.fetchall()
    
    return lineups


@router.get("/{lineup_id}", response_model=Lineup)
def get_lineup(lineup_id: int):
    """Get a specific lineup entry by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM lineups WHERE id = %s", (lineup_id,))
        lineup = cursor.fetchone()
    
    if not lineup:
        raise HTTPException(status_code=404, detail="Lineup entry not found")
    
    return lineup


@router.post("", response_model=BulkCreateResponse)
def create_lineups(bulk_data: BulkLineupsCreate):
    """Bulk insert or update lineups."""
    if not bulk_data.lineups:
        raise HTTPException(status_code=400, detail="No lineups provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for lineup in bulk_data.lineups:
            cursor.execute("""
                INSERT INTO lineups (
                    matchup_id, fantasy_team_id, player_id,
                    lineup_slot, is_starter
                )
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    player_id = EXCLUDED.player_id,
                    lineup_slot = EXCLUDED.lineup_slot,
                    is_starter = EXCLUDED.is_starter,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                lineup.matchup_id,
                lineup.fantasy_team_id,
                lineup.player_id,
                lineup.lineup_slot,
                lineup.is_starter
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
        message=f"Processed {len(bulk_data.lineups)} lineup entries: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{lineup_id}")
def delete_lineup(lineup_id: int):
    """Delete a lineup entry by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM lineups WHERE id = %s RETURNING id", (lineup_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Lineup entry not found")
    
    return {"success": True, "message": f"Lineup entry {lineup_id} deleted"}
