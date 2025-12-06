"""
NFL Teams API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    NFLTeam, NFLTeamCreate, BulkNFLTeamsCreate, 
    BulkCreateResponse, ErrorResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/nfl/teams", tags=["NFL Teams"])


@router.get("", response_model=List[NFLTeam])
def get_teams(
    conference: Optional[str] = Query(None, pattern="^(AFC|NFC)$"),
    division: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=100)
):
    """
    Get all NFL teams with optional filtering.
    
    - **conference**: Filter by AFC or NFC
    - **division**: Filter by division (North, South, East, West)
    - **limit**: Maximum number of teams to return
    """
    query = "SELECT * FROM nfl_teams WHERE 1=1"
    params = []
    
    if conference:
        query += " AND conference = %s"
        params.append(conference)
    
    if division:
        query += " AND division = %s"
        params.append(division)
    
    query += " ORDER BY conference, division, team_name LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        teams = cursor.fetchall()
    
    return teams


@router.get("/{team_id}", response_model=NFLTeam)
def get_team(team_id: int):
    """Get a specific NFL team by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM nfl_teams WHERE id = %s", (team_id,))
        team = cursor.fetchone()
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return team


@router.get("/code/{team_code}", response_model=NFLTeam)
def get_team_by_code(team_code: str):
    """Get a specific NFL team by team code (e.g., 'KC', 'SF')."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM nfl_teams WHERE team_code = %s", (team_code.upper(),))
        team = cursor.fetchone()
    
    if not team:
        raise HTTPException(status_code=404, detail=f"Team with code '{team_code}' not found")
    
    return team


@router.post("", response_model=BulkCreateResponse)
def create_teams(bulk_data: BulkNFLTeamsCreate):
    """
    Bulk insert or update NFL teams.
    
    Uses upsert logic - if team_code exists, updates the team.
    """
    if not bulk_data.teams:
        raise HTTPException(status_code=400, detail="No teams provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for team in bulk_data.teams:
            cursor.execute("""
                INSERT INTO nfl_teams (team_code, team_name, city, conference, division)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (team_code) DO UPDATE SET
                    team_name = EXCLUDED.team_name,
                    city = EXCLUDED.city,
                    conference = EXCLUDED.conference,
                    division = EXCLUDED.division,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                team.team_code,
                team.team_name,
                team.city,
                team.conference,
                team.division
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
    """Delete an NFL team by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM nfl_teams WHERE id = %s RETURNING id", (team_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"success": True, "message": f"Team {team_id} deleted"}
