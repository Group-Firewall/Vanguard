"""Database configuration and session management"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
import os

# Build MySQL URL if DATABASE_URL is not set or is SQLite
def get_database_url():
    """Get database URL, constructing MySQL URL if needed"""
    if settings.DATABASE_URL and not settings.DATABASE_URL.startswith("sqlite"):
        return settings.DATABASE_URL
    
    # Check if MySQL settings are provided
    mysql_user = os.getenv("MYSQL_USER", settings.MYSQL_USER)
    mysql_password = os.getenv("MYSQL_PASSWORD", settings.MYSQL_PASSWORD)
    mysql_host = os.getenv("MYSQL_HOST", settings.MYSQL_HOST)
    mysql_port = os.getenv("MYSQL_PORT", str(settings.MYSQL_PORT))
    mysql_database = os.getenv("MYSQL_DATABASE", settings.MYSQL_DATABASE)
    
    # If MySQL credentials are set, use MySQL
    if mysql_user and mysql_database and mysql_user != "root" or (mysql_user == "root" and mysql_password):
        return f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}"
    
    # Default to SQLite
    return settings.DATABASE_URL or "sqlite:///./vanguard.db"

database_url = get_database_url()

# Create database engine
connect_args = {}
if "sqlite" in database_url:
    connect_args = {"check_same_thread": False}
elif "mysql" in database_url:
    connect_args = {"charset": "utf8mb4"}

engine = create_engine(
    database_url,
    connect_args=connect_args,
    echo=settings.DEBUG,
    pool_pre_ping=True  # Verify connections before using
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    from app.models import Alert, Packet, Metric, ModelPerformance
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized successfully! (Using: {database_url.split('@')[-1] if '@' in database_url else database_url})")


if __name__ == "__main__":
    init_db()
