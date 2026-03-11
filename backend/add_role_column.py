"""Add role column to users table migration script"""
from sqlalchemy import text
from app.database import engine

def add_role_column():
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'role' not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'analyst'"))
            conn.commit()
            print("Added 'role' column to users table")
        else:
            print("'role' column already exists")

if __name__ == "__main__":
    add_role_column()
