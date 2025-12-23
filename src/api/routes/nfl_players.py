"""
NFL Players API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    NFLPlayer, NFLPlayerCreate, BulkNFLPlayersCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/nfl/players", tags=["NFL Players"])


@router.get("", response_model=List[NFLPlayer])
def get_players(
    position: Optional[str] = Query(None),
    nfl_team_id: Optional[int] = Query(None),
    status: str = Query("active"),
    limit: int = Query(100, ge=1, le=10000)
):
    """
    Get NFL players with optional filtering.
    
    - **position**: Filter by position (QB, RB, WR, TE, K, DEF)
    - **nfl_team_id**: Filter by team ID
    - **status**: Filter by status (active, injured, suspended, retired)
    - **limit**: Maximum number of players to return
    """
    query = "SELECT * FROM players WHERE 1=1"
    params = []
    
    if position:
        query += " AND position = %s"
        params.append(position.upper())
    
    if nfl_team_id:
        query += " AND nfl_team_id = %s"
        params.append(nfl_team_id)
    
    if status:
        query += " AND status = %s"
        params.append(status)
    
    query += " ORDER BY last_name, first_name LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        players = cursor.fetchall()
    
    return players


@router.get("/{player_id}", response_model=NFLPlayer)
def get_player(player_id: int):
    """Get a specific NFL player by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM players WHERE id = %s", (player_id,))
        player = cursor.fetchone()
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return player


@router.get("/external/{external_id}", response_model=NFLPlayer)
def get_player_by_external_id(external_id: str):
    """Get a player by external ID (ESPN ID)."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM players WHERE external_id = %s", (external_id,))
        player = cursor.fetchone()
    
    if not player:
        raise HTTPException(status_code=404, detail=f"Player with external_id '{external_id}' not found")
    
    return player


@router.post("", response_model=BulkCreateResponse)
def create_players(bulk_data: BulkNFLPlayersCreate):
    """
    Bulk insert or update NFL players.
    
    Uses upsert logic based on external_id if provided.
    """
    if not bulk_data.players:
        raise HTTPException(status_code=400, detail="No players provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for player in bulk_data.players:
            if player.external_id:
                # Upsert based on external_id
                cursor.execute("""
                    INSERT INTO players (
                        external_id, first_name, last_name, position,
                        nfl_team_id, jersey_number, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (external_id) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        position = EXCLUDED.position,
                        nfl_team_id = EXCLUDED.nfl_team_id,
                        jersey_number = EXCLUDED.jersey_number,
                        status = EXCLUDED.status,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING (xmax = 0) AS inserted
                """, (
                    player.external_id,
                    player.first_name,
                    player.last_name,
                    player.position,
                    player.nfl_team_id,
                    player.jersey_number,
                    player.status
                ))
            else:
                # Insert without external_id
                cursor.execute("""
                    INSERT INTO players (
                        first_name, last_name, position,
                        nfl_team_id, jersey_number, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING TRUE AS inserted
                """, (
                    player.first_name,
                    player.last_name,
                    player.position,
                    player.nfl_team_id,
                    player.jersey_number,
                    player.status
                ))
            
            result = cursor.fetchone()
            if result.get('inserted'):
                inserted_count += 1
            else:
                updated_count += 1
    
    return BulkCreateResponse(
        success=True,
        inserted_count=inserted_count,
        updated_count=updated_count,
        message=f"Processed {len(bulk_data.players)} players: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{player_id}")
def delete_player(player_id: int):
    """Delete an NFL player by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM players WHERE id = %s RETURNING id", (player_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return {"success": True, "message": f"Player {player_id} deleted"}
