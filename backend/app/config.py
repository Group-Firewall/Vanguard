"""Configuration settings for Vanguard NIDS"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Vanguard NIDS"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database
    # For MySQL: mysql+pymysql://username:password@localhost:3306/vanguard
    # For SQLite: sqlite:///./vanguard.db
    DATABASE_URL: str = "sqlite:///./vanguard.db"
    
    # MySQL specific settings (if using MySQL)
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DATABASE: str = "vanguard"
    
    # Redis (for background tasks)
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Model paths
    MODEL_PATH: str = "./models"
    SUPERVISED_MODEL_PATH: str = "./models/supervised"
    UNSUPERVISED_MODEL_PATH: str = "./models/unsupervised"
    HYBRID_MODEL_PATH: str = "./models/hybrid"
    
    # Data paths
    DATA_PATH: str = "./data/datasets"
    RAW_DATA_PATH: str = "./data/raw"
    PROCESSED_DATA_PATH: str = "./data/processed"
    
    # Packet capture
    INTERFACE: Optional[str] = None  # Auto-detect if None
    CAPTURE_FILTER: str = "tcp or udp"
    PACKET_BUFFER_SIZE: int = 1000
    
    # Detection thresholds
    SIGNATURE_CONFIDENCE_THRESHOLD: float = 0.7
    ML_ANOMALY_THRESHOLD: float = 0.6
    HYBRID_FUSION_THRESHOLD: float = 0.65
    
    # Alert settings
    ALERT_RETENTION_DAYS: int = 30
    MAX_ALERTS_PER_MINUTE: int = 100
    
    # Feature extraction
    FEATURE_WINDOW_SIZE: int = 100  # packets per window
    FEATURE_EXTRACTION_INTERVAL: float = 1.0  # seconds
    
    # Model retraining
    RETRAIN_INTERVAL_HOURS: int = 24
    MIN_SAMPLES_FOR_RETRAIN: int = 1000
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Create directories if they don't exist
os.makedirs(settings.MODEL_PATH, exist_ok=True)
os.makedirs(settings.SUPERVISED_MODEL_PATH, exist_ok=True)
os.makedirs(settings.UNSUPERVISED_MODEL_PATH, exist_ok=True)
os.makedirs(settings.HYBRID_MODEL_PATH, exist_ok=True)
os.makedirs(settings.DATA_PATH, exist_ok=True)
os.makedirs(settings.RAW_DATA_PATH, exist_ok=True)
os.makedirs(settings.PROCESSED_DATA_PATH, exist_ok=True)

