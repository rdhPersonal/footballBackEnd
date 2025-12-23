#!/usr/bin/env python3
"""
Script to fix fantasy data upsert logic by:
1. Cleaning up duplicate data
2. Adding proper unique constraints
3. Testing the fixed upsert logic
"""
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.database import get_db_cursor
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def clean_duplicate_leagues():
    """Remove duplicate league entries, keeping the most recent one."""
    logger.info("Cleaning duplicate league entries...")
    
    with get_db_cursor() as cursor:
        # Find duplicates based on espn_league_id + season
        cursor.execute("""
            SELECT espn_league_id, season, COUNT(*) as count, 
                   array_agg(id ORDER BY created_at DESC) as ids
            FROM league 
            WHERE espn_league_id IS NOT NULL
            GROUP BY espn_league_id, season 
            HAVING COUNT(*) > 1
        """)
        
        duplicates = cursor.fetchall()
        
        for dup in duplicates:
            espn_id = dup['espn_league_id']
            season = dup['season']
            ids = dup['ids']
            keep_id = ids[0]  # Keep the most recent one
            delete_ids = ids[1:]  # Delete the rest
            
            logger.info(f"League {espn_id} season {season}: keeping ID {keep_id}, deleting {delete_ids}")
            
            # Delete the older duplicates
            for delete_id in delete_ids:
                cursor.execute("DELETE FROM league WHERE id = %s", (delete_id,))
        
        logger.info(f"Cleaned up {len(duplicates)} duplicate league groups")


def clean_duplicate_teams():
    """Remove duplicate fantasy team entries."""
    logger.info("Cleaning duplicate fantasy team entries...")
    
    with get_db_cursor() as cursor:
        # Find duplicates based on league_id + espn_team_id
        cursor.execute("""
            SELECT league_id, espn_team_id, COUNT(*) as count,
                   array_agg(id ORDER BY created_at DESC) as ids
            FROM fantasy_teams 
            WHERE espn_team_id IS NOT NULL
            GROUP BY league_id, espn_team_id 
            HAVING COUNT(*) > 1
        """)
        
        duplicates = cursor.fetchall()
        
        for dup in duplicates:
            league_id = dup['league_id']
            espn_team_id = dup['espn_team_id']
            ids = dup['ids']
            keep_id = ids[0]  # Keep the most recent one
            delete_ids = ids[1:]  # Delete the rest
            
            logger.info(f"Team {espn_team_id} in league {league_id}: keeping ID {keep_id}, deleting {delete_ids}")
            
            # Delete the older duplicates
            for delete_id in delete_ids:
                cursor.execute("DELETE FROM fantasy_teams WHERE id = %s", (delete_id,))
        
        logger.info(f"Cleaned up {len(duplicates)} duplicate team groups")


def clean_duplicate_draft_picks():
    """Remove duplicate draft picks."""
    logger.info("Cleaning duplicate draft picks...")
    
    with get_db_cursor() as cursor:
        # The draft_picks table already has UNIQUE(league_id, pick_number)
        # So we shouldn't have duplicates, but let's check
        cursor.execute("""
            SELECT league_id, pick_number, COUNT(*) as count,
                   array_agg(id ORDER BY created_at DESC) as ids
            FROM draft_picks 
            GROUP BY league_id, pick_number 
            HAVING COUNT(*) > 1
        """)
        
        duplicates = cursor.fetchall()
        
        if duplicates:
            logger.warning(f"Found {len(duplicates)} duplicate draft pick groups - this shouldn't happen!")
            for dup in duplicates:
                league_id = dup['league_id']
                pick_number = dup['pick_number']
                ids = dup['ids']
                keep_id = ids[0]
                delete_ids = ids[1:]
                
                logger.info(f"Draft pick {pick_number} in league {league_id}: keeping ID {keep_id}, deleting {delete_ids}")
                
                for delete_id in delete_ids:
                    cursor.execute("DELETE FROM draft_picks WHERE id = %s", (delete_id,))
        else:
            logger.info("No duplicate draft picks found")


def clean_duplicate_roster_entries():
    """Remove duplicate roster entries."""
    logger.info("Cleaning duplicate roster entries...")
    
    with get_db_cursor() as cursor:
        # Find duplicates based on fantasy_team_id + player_id + acquired_date
        cursor.execute("""
            SELECT fantasy_team_id, player_id, acquired_date, COUNT(*) as count,
                   array_agg(id ORDER BY created_at DESC) as ids
            FROM roster_entries 
            GROUP BY fantasy_team_id, player_id, acquired_date 
            HAVING COUNT(*) > 1
        """)
        
        duplicates = cursor.fetchall()
        
        for dup in duplicates:
            team_id = dup['fantasy_team_id']
            player_id = dup['player_id']
            acquired_date = dup['acquired_date']
            ids = dup['ids']
            keep_id = ids[0]
            delete_ids = ids[1:]
            
            logger.info(f"Roster entry team {team_id} player {player_id} date {acquired_date}: keeping ID {keep_id}, deleting {delete_ids}")
            
            for delete_id in delete_ids:
                cursor.execute("DELETE FROM roster_entries WHERE id = %s", (delete_id,))
        
        logger.info(f"Cleaned up {len(duplicates)} duplicate roster entry groups")


def add_unique_constraints():
    """Add proper unique constraints to fantasy tables."""
    logger.info("Adding unique constraints...")
    
    constraints = [
        {
            'table': 'league',
            'name': 'unique_league_espn_season',
            'columns': '(espn_league_id, season)',
            'condition': 'WHERE espn_league_id IS NOT NULL'
        },
        {
            'table': 'fantasy_teams',
            'name': 'unique_team_league_espn',
            'columns': '(league_id, espn_team_id)',
            'condition': 'WHERE espn_team_id IS NOT NULL'
        },
        {
            'table': 'roster_entries',
            'name': 'unique_roster_team_player_date',
            'columns': '(fantasy_team_id, player_id, acquired_date)',
            'condition': ''
        }
    ]
    
    with get_db_cursor() as cursor:
        for constraint in constraints:
            try:
                sql = f"""
                    ALTER TABLE {constraint['table']} 
                    ADD CONSTRAINT {constraint['name']} 
                    UNIQUE {constraint['columns']} {constraint['condition']}
                """
                cursor.execute(sql)
                logger.info(f"Added constraint {constraint['name']} to {constraint['table']}")
            except Exception as e:
                if "already exists" in str(e):
                    logger.info(f"Constraint {constraint['name']} already exists")
                else:
                    logger.error(f"Failed to add constraint {constraint['name']}: {e}")


def show_current_data():
    """Show current fantasy data counts."""
    logger.info("Current fantasy data counts:")
    
    with get_db_cursor(commit=False) as cursor:
        tables = [
            ('league', 'Leagues'),
            ('fantasy_teams', 'Fantasy Teams'),
            ('draft_picks', 'Draft Picks'),
            ('roster_entries', 'Roster Entries')
        ]
        
        for table, label in tables:
            cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
            count = cursor.fetchone()['count']
            logger.info(f"  {label}: {count}")


def main():
    logger.info("Starting fantasy data cleanup and constraint fixes...")
    
    # Show current state
    show_current_data()
    
    # Clean up duplicates
    clean_duplicate_leagues()
    clean_duplicate_teams()
    clean_duplicate_draft_picks()
    clean_duplicate_roster_entries()
    
    # Add unique constraints
    add_unique_constraints()
    
    # Show final state
    logger.info("\nAfter cleanup:")
    show_current_data()
    
    logger.info("Fantasy data cleanup complete!")


if __name__ == '__main__':
    main()