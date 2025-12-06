"""
NFL Player Game Statistics API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    PlayerGameStats, PlayerGameStatsCreate, BulkPlayerGameStatsCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/nfl/stats", tags=["NFL Player Stats"])


@router.get("", response_model=List[PlayerGameStats])
def get_stats(
    player_id: Optional[int] = Query(None),
    nfl_game_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Get player game statistics with optional filtering.
    
    - **player_id**: Filter by player ID
    - **nfl_game_id**: Filter by game ID
    - **limit**: Maximum number of stat records to return
    """
    query = "SELECT * FROM player_game_stats WHERE 1=1"
    params = []
    
    if player_id is not None:
        query += " AND player_id = %s"
        params.append(player_id)
    
    if nfl_game_id is not None:
        query += " AND nfl_game_id = %s"
        params.append(nfl_game_id)
    
    query += " ORDER BY nfl_game_id DESC, player_id LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        stats = cursor.fetchall()
    
    return stats


@router.get("/{stat_id}", response_model=PlayerGameStats)
def get_stat(stat_id: int):
    """Get specific player game stats by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM player_game_stats WHERE id = %s", (stat_id,))
        stat = cursor.fetchone()
    
    if not stat:
        raise HTTPException(status_code=404, detail="Stats not found")
    
    return stat


@router.get("/player/{player_id}", response_model=List[PlayerGameStats])
def get_player_stats(player_id: int, limit: int = Query(100, ge=1, le=500)):
    """Get all game stats for a specific player."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("""
            SELECT pgs.* 
            FROM player_game_stats pgs
            JOIN nfl_games g ON pgs.nfl_game_id = g.id
            WHERE pgs.player_id = %s
            ORDER BY g.game_date DESC
            LIMIT %s
        """, (player_id, limit))
        stats = cursor.fetchall()
    
    return stats


@router.get("/game/{game_id}", response_model=List[PlayerGameStats])
def get_game_stats(game_id: int):
    """Get all player stats for a specific game."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("""
            SELECT * FROM player_game_stats
            WHERE nfl_game_id = %s
            ORDER BY player_id
        """, (game_id,))
        stats = cursor.fetchall()
    
    return stats


@router.get("/player/{player_id}/season/{season}", response_model=List[PlayerGameStats])
def get_player_season_stats(player_id: int, season: int):
    """Get all stats for a player in a specific season."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("""
            SELECT pgs.* 
            FROM player_game_stats pgs
            JOIN nfl_games g ON pgs.nfl_game_id = g.id
            WHERE pgs.player_id = %s AND g.season = %s
            ORDER BY g.week
        """, (player_id, season))
        stats = cursor.fetchall()
    
    return stats


@router.post("", response_model=BulkCreateResponse)
def create_stats(bulk_data: BulkPlayerGameStatsCreate):
    """
    Bulk insert or update player game statistics.
    
    Uses upsert logic based on player_id and nfl_game_id.
    """
    if not bulk_data.stats:
        raise HTTPException(status_code=400, detail="No stats provided")
    
    inserted_count = 0
    updated_count = 0
    
    with get_db_cursor() as cursor:
        for stat in bulk_data.stats:
            cursor.execute("""
                INSERT INTO player_game_stats (
                    player_id, nfl_game_id,
                    passing_attempts, passing_completions, passing_yards, passing_touchdowns, interceptions,
                    rushing_attempts, rushing_yards, rushing_touchdowns,
                    receptions, receiving_yards, receiving_touchdowns, targets,
                    fumbles_lost, two_point_conversions,
                    field_goals_made, field_goals_attempted, extra_points_made, extra_points_attempted,
                    sacks, interceptions_defense, fumbles_recovered, touchdowns_defense, points_allowed
                )
                VALUES (
                    %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                )
                ON CONFLICT (player_id, nfl_game_id) DO UPDATE SET
                    passing_attempts = EXCLUDED.passing_attempts,
                    passing_completions = EXCLUDED.passing_completions,
                    passing_yards = EXCLUDED.passing_yards,
                    passing_touchdowns = EXCLUDED.passing_touchdowns,
                    interceptions = EXCLUDED.interceptions,
                    rushing_attempts = EXCLUDED.rushing_attempts,
                    rushing_yards = EXCLUDED.rushing_yards,
                    rushing_touchdowns = EXCLUDED.rushing_touchdowns,
                    receptions = EXCLUDED.receptions,
                    receiving_yards = EXCLUDED.receiving_yards,
                    receiving_touchdowns = EXCLUDED.receiving_touchdowns,
                    targets = EXCLUDED.targets,
                    fumbles_lost = EXCLUDED.fumbles_lost,
                    two_point_conversions = EXCLUDED.two_point_conversions,
                    field_goals_made = EXCLUDED.field_goals_made,
                    field_goals_attempted = EXCLUDED.field_goals_attempted,
                    extra_points_made = EXCLUDED.extra_points_made,
                    extra_points_attempted = EXCLUDED.extra_points_attempted,
                    sacks = EXCLUDED.sacks,
                    interceptions_defense = EXCLUDED.interceptions_defense,
                    fumbles_recovered = EXCLUDED.fumbles_recovered,
                    touchdowns_defense = EXCLUDED.touchdowns_defense,
                    points_allowed = EXCLUDED.points_allowed,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING (xmax = 0) AS inserted
            """, (
                stat.player_id, stat.nfl_game_id,
                stat.passing_attempts, stat.passing_completions, stat.passing_yards, 
                stat.passing_touchdowns, stat.interceptions,
                stat.rushing_attempts, stat.rushing_yards, stat.rushing_touchdowns,
                stat.receptions, stat.receiving_yards, stat.receiving_touchdowns, stat.targets,
                stat.fumbles_lost, stat.two_point_conversions,
                stat.field_goals_made, stat.field_goals_attempted, 
                stat.extra_points_made, stat.extra_points_attempted,
                stat.sacks, stat.interceptions_defense, stat.fumbles_recovered, 
                stat.touchdowns_defense, stat.points_allowed
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
        message=f"Processed {len(bulk_data.stats)} stat records: {inserted_count} inserted, {updated_count} updated"
    )


@router.delete("/{stat_id}")
def delete_stat(stat_id: int):
    """Delete player game stats by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM player_game_stats WHERE id = %s RETURNING id", (stat_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Stats not found")
    
    return {"success": True, "message": f"Stats {stat_id} deleted"}
