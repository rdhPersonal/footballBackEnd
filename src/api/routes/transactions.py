"""
Transactions API endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from src.api.models import (
    Transaction, TransactionCreate, BulkTransactionsCreate,
    BulkCreateResponse
)
from src.database import get_db_cursor

router = APIRouter(prefix="/api/fantasy/transactions", tags=["Transactions"])


@router.get("", response_model=List[Transaction])
def get_transactions(
    league_id: Optional[int] = Query(None),
    fantasy_team_id: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=500)
):
    """Get all transactions with optional filtering."""
    query = "SELECT * FROM transactions WHERE 1=1"
    params = []
    
    if league_id:
        query += " AND league_id = %s"
        params.append(league_id)
    
    if fantasy_team_id:
        query += " AND fantasy_team_id = %s"
        params.append(fantasy_team_id)
    
    if transaction_type:
        query += " AND transaction_type = %s"
        params.append(transaction_type)
    
    query += " ORDER BY transaction_date DESC LIMIT %s"
    params.append(limit)
    
    with get_db_cursor(commit=False) as cursor:
        cursor.execute(query, params)
        transactions = cursor.fetchall()
    
    return transactions


@router.get("/{transaction_id}", response_model=Transaction)
def get_transaction(transaction_id: int):
    """Get a specific transaction by ID."""
    with get_db_cursor(commit=False) as cursor:
        cursor.execute("SELECT * FROM transactions WHERE id = %s", (transaction_id,))
        transaction = cursor.fetchone()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return transaction


@router.post("", response_model=BulkCreateResponse)
def create_transactions(bulk_data: BulkTransactionsCreate):
    """Bulk insert transactions."""
    if not bulk_data.transactions:
        raise HTTPException(status_code=400, detail="No transactions provided")
    
    inserted_count = 0
    
    with get_db_cursor() as cursor:
        for txn in bulk_data.transactions:
            cursor.execute("""
                INSERT INTO transactions (
                    league_id, transaction_type, transaction_date,
                    fantasy_team_id, player_id, related_transaction_id, notes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                txn.league_id,
                txn.transaction_type,
                txn.transaction_date,
                txn.fantasy_team_id,
                txn.player_id,
                txn.related_transaction_id,
                txn.notes
            ))
            
            if cursor.fetchone():
                inserted_count += 1
    
    return BulkCreateResponse(
        success=True,
        inserted_count=inserted_count,
        updated_count=0,
        message=f"Inserted {inserted_count} transactions"
    )


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int):
    """Delete a transaction by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM transactions WHERE id = %s RETURNING id", (transaction_id,))
        deleted = cursor.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {"success": True, "message": f"Transaction {transaction_id} deleted"}
