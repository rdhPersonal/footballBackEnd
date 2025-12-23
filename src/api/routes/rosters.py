"""
Roster Entries API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    RosterEntry, RosterEntryCreate, BulkRosterEntriesCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/fantasy/rosters", tags=["Rosters"])


@router.get("", response_model=List[RosterEntry])
def get_roster_entries(
    fantasy_team_id: Optional[int] = Query(None),
    player_id: Optional[int] = Query(None),
    limit: int = Query(500, ge=1, le=500)
):
    """Get all roster entries with optional filtering."""
    query = "SELECT * FROM roster_entries WHERE 1=1"
    params = []
    
    if fantasy_team_id:
        query += " AND fantasy_team_id = %s"
        params.append(fantasy_team_id)
    
    if player_id:
        query += " AND player_id = %s"
        params.append(player_id)
    
    query += " ORDER BY acquired_date DESC LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        entries = cursor.fetchall()
    
    return entries


@router.get("/{entry_id}", response_model=RosterEntry)
def get_roster_entry(entry_id: int):
    """Get a specific roster entry by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM roster_entries WHERE id = %s", (entry_id,))
        entry = cursor.fetchone()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    
    return entry


@router.post("", response_model=BulkCreateResponse)
def create_roster_entries(bulk_data: BulkRosterEntriesCreate):
    """Bulk insert or update roster entries."""
    if not bulk_data.entries:
        raise HTTPException(status_code=400, detail="No roster entries provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for entry in bulk_data.entries:
            cursor.execute("""
                INSERT INTO roster_entries (
                    fantasy_team_id, player_id, acquired_date, released_date, acquisition_type
                )
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (fantasy_team_id, player_id, acquired_date) DO UPDATE SET
                    released_date = EXCLUDED.released_date,
                    acquisition_type = EXCLUDED.acquisition_type,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                entry.fantasy_team_id,
                entry.player_id,
                entry.acquired_date,
                entry.released_date,
                entry.acquisition_type
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
        message=f"Processed {len(bulk_data.entries)} roster entries: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{entry_id}")
def delete_roster_entry(entry_id: int):
    """Delete a roster entry by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM roster_entries WHERE id = %s RETURNING id", (entry_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    
    return {"success": True, "message": f"Roster entry {entry_id} deleted"}
