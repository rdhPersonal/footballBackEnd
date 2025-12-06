"""
Fantasy Teams API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    FantasyTeam, FantasyTeamCreate, BulkFantasyTeamsCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/fantasy/teams", tags=["Fantasy Teams"])


@router.get("", response_model=List[FantasyTeam])
def get_teams(
    league_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=100)
):
    """Get all fantasy teams with optional filtering."""
    query = "SELECT * FROM fantasy_teams WHERE 1=1"
    params = []
    
    if league_id:
        query += " AND league_id = %s"
        params.append(league_id)
    
    query += " ORDER BY team_name LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        teams = cursor.fetchall()
    
    return teams


@router.get("/{team_id}", response_model=FantasyTeam)
def get_team(team_id: int):
    """Get a specific fantasy team by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM fantasy_teams WHERE id = %s", (team_id,))
        team = cursor.fetchone()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return team


@router.post("", response_model=BulkCreateResponse)
def create_teams(bulk_data: BulkFantasyTeamsCreate):
    """Bulk insert or update fantasy teams."""
    if not bulk_data.teams:
        raise HTTPException(status_code=400, detail="No teams provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for team in bulk_data.teams:
            cursor.execute("""
                INSERT INTO fantasy_teams (
                    league_id, team_name, owner_name, espn_team_id
                )
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    team_name = EXCLUDED.team_name,
                    owner_name = EXCLUDED.owner_name,
                    espn_team_id = EXCLUDED.espn_team_id,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                team.league_id,
                team.team_name,
                team.owner_name,
                team.espn_team_id
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
        message=f"Processed {len(bulk_data.teams)} teams: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{team_id}")
def delete_team(team_id: int):
    """Delete a fantasy team by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM fantasy_teams WHERE id = %s RETURNING id", (team_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"success": True, "message": f"Team {team_id} deleted"}
