"""
Fantasy Leagues API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    FantasyLeague, FantasyLeagueCreate, BulkFantasyLeaguesCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/fantasy/leagues", tags=["Fantasy Leagues"])


@router.get("", response_model=List[FantasyLeague])
def get_leagues(
    season: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=100)
):
    """Get all fantasy leagues with optional filtering."""
    query = "SELECT * FROM league WHERE 1=1"
    params = []
    
    if season:
        query += " AND season = %s"
        params.append(season)
    
    query += " ORDER BY season DESC, name LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        leagues = cursor.fetchall()
    
    return leagues


@router.get("/{league_id}", response_model=FantasyLeague)
def get_league(league_id: int):
    """Get a specific fantasy league by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM league WHERE id = %s", (league_id,))
        league = cursor.fetchone()
    
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    return league


@router.get("/espn/{espn_league_id}", response_model=FantasyLeague)
def get_league_by_espn_id(espn_league_id: str):
    """Get a specific fantasy league by ESPN league ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM league WHERE espn_league_id = %s", (espn_league_id,))
        league = cursor.fetchone()
    
    if not league:
        raise HTTPException(status_code=404, detail=f"League with ESPN ID '{espn_league_id}' not found")
    
    return league


@router.post("", response_model=BulkCreateResponse)
def create_leagues(bulk_data: BulkFantasyLeaguesCreate):
    """Bulk insert or update fantasy leagues."""
    if not bulk_data.leagues:
        raise HTTPException(status_code=400, detail="No leagues provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for league in bulk_data.leagues:
            cursor.execute("""
                INSERT INTO league (name, season, espn_league_id, num_teams, playoff_start_week, championship_week)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    espn_league_id = EXCLUDED.espn_league_id,
                    num_teams = EXCLUDED.num_teams,
                    playoff_start_week = EXCLUDED.playoff_start_week,
                    championship_week = EXCLUDED.championship_week,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                league.name,
                league.season,
                league.espn_league_id,
                league.num_teams,
                league.playoff_start_week,
                league.championship_week
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
        message=f"Processed {len(bulk_data.leagues)} leagues: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{league_id}")
def delete_league(league_id: int):
    """Delete a fantasy league by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM league WHERE id = %s RETURNING id", (league_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="League not found")
    
    return {"success": True, "message": f"League {league_id} deleted"}
