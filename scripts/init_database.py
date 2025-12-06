#!/usr/bin/env python3
"""
Initialize the database schema.
Connects to RDS from within the VPC using a bastion or from local machine.
"""

import psycopg2
import sys

# Database connection parameters
DB_HOST = "fantasy-football-dev-db.cpapglostuzx.us-east-1.rds.amazonaws.com"
DB_PORT = 5432
DB_NAME = "fantasy_football"
DB_USER = "postgres"
DB_PASSWORD = "lkajs098));sd333"

def main():
    try:
        print(f"Connecting to {DB_HOST}:{DB_PORT}/{DB_NAME}...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=10
        )
        
        print("Connected successfully!")
        
        # Read schema file
        with open('../database/schema.sql', 'r') as f:
            schema_sql = f.read()
        
        # Execute schema
        cursor = conn.cursor()
        print("Executing schema...")
        cursor.execute(schema_sql)
        conn.commit()
        
        print("Schema initialized successfully!")
        
        # Verify tables were created
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        print(f"\nCreated {len(tables)} tables:")
        for table in tables:
            print(f"  - {table[0]}")
        
        cursor.close()
        conn.close()
        
    except psycopg2.OperationalError as e:
        print(f"Connection error: {e}")
        print("\nTroubleshooting:")
        print("1. Ensure RDS is publicly accessible (temporarily)")
        print("2. Check security group allows your IP")
        print("3. Verify RDS is in a public subnet or use a bastion host")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
