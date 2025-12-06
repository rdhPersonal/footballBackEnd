"""
Database connection and utilities.
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import logging
from typing import Generator

from src.config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

logger = logging.getLogger(__name__)


def get_connection():
    """Create a database connection."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=10
        )
        return conn
    except psycopg2.Error as e:
        logger.error(f"Database connection error: {e}")
        raise


@contextmanager
def get_db_cursor(commit: bool = True) -> Generator:
    """
    Context manager for database operations.
    
    Args:
        commit: Whether to commit the transaction on success
        
    Yields:
        Database cursor
    """
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        yield cursor
        if commit:
            conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database operation error: {e}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def execute_query(query: str, params: tuple = None, fetch: bool = False):
    """
    Execute a database query.
    
    Args:
        query: SQL query string
        params: Query parameters
        fetch: Whether to fetch results
        
    Returns:
        Query results if fetch=True, otherwise None
    """
    with get_db_cursor() as cursor:
        cursor.execute(query, params)
        if fetch:
            return cursor.fetchall()
        return None


def bulk_insert(table: str, columns: list, values: list):
    """
    Perform bulk insert into a table.
    
    Args:
        table: Table name
        columns: List of column names
        values: List of tuples with values
    """
    if not values:
        return
    
    placeholders = ','.join(['%s'] * len(columns))
    columns_str = ','.join(columns)
    query = f"INSERT INTO {table} ({columns_str}) VALUES ({placeholders})"
    
    with get_db_cursor() as cursor:
        cursor.executemany(query, values)
    
    logger.info(f"Inserted {len(values)} rows into {table}")
