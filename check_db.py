#!/usr/bin/env python3
"""Check database tables."""

import sys
from pathlib import Path
import sqlite3

# Check the database
db_path = Path("c:/Users/Absolomjr/Desktop/Vanguard/backend/vanguard.db")
print(f"Database path: {db_path}")
print(f"Database exists: {db_path.exists()}")
print(f"Database size: {db_path.stat().st_size} bytes")

# Connect and check tables
try:
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print(f"\nTables in database: {len(tables)}")
    for table in tables:
        print(f"  - {table[0]}")
    
    # Check alerts table specifically
    try:
        cursor.execute("SELECT COUNT(*) FROM alerts;")
        count = cursor.fetchone()[0]
        print(f"\nAlerts table exists with {count} rows")
    except Exception as e:
        print(f"\nAlerts table error: {e}")
    
    conn.close()
    
except Exception as e:
    print(f"Database connection error: {e}")
    import traceback
    traceback.print_exc()
