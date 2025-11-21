"""Incremental data storage for online learning"""
import pandas as pd
import sqlite3
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IncrementalStorage:
    """Store data incrementally for online learning"""
    
    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            db_path = Path(settings.DATA_PATH) / "incremental_data.db"
        
        self.db_path = db_path
        self.conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._init_tables()
    
    def _init_tables(self):
        """Initialize database tables"""
        cursor = self.conn.cursor()
        
        # Create packets table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS packets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                features TEXT,
                label TEXT,
                prediction TEXT,
                confidence REAL,
                is_verified BOOLEAN DEFAULT 0
            )
        """)
        
        # Create features table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                packet_id INTEGER,
                feature_name TEXT,
                feature_value REAL,
                FOREIGN KEY (packet_id) REFERENCES packets(id)
            )
        """)
        
        # Create index
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp ON packets(timestamp)
        """)
        
        self.conn.commit()
        logger.info("Initialized incremental storage tables")
    
    def store_packet(self, features: Dict, label: Optional[str] = None, 
                    prediction: Optional[str] = None, confidence: Optional[float] = None):
        """Store a single packet with features"""
        cursor = self.conn.cursor()
        
        # Insert packet
        cursor.execute("""
            INSERT INTO packets (features, label, prediction, confidence)
            VALUES (?, ?, ?, ?)
        """, (
            str(features),
            label,
            prediction,
            confidence
        ))
        
        packet_id = cursor.lastrowid
        
        # Insert features
        for feature_name, feature_value in features.items():
            if isinstance(feature_value, (int, float)):
                cursor.execute("""
                    INSERT INTO features (packet_id, feature_name, feature_value)
                    VALUES (?, ?, ?)
                """, (packet_id, feature_name, feature_value))
        
        self.conn.commit()
        return packet_id
    
    def store_batch(self, packets: List[Dict]):
        """Store multiple packets in batch"""
        logger.info(f"Storing batch of {len(packets)} packets...")
        
        for packet in packets:
            self.store_packet(
                features=packet.get('features', {}),
                label=packet.get('label'),
                prediction=packet.get('prediction'),
                confidence=packet.get('confidence')
            )
        
        logger.info("Batch stored successfully")
    
    def get_recent_packets(self, n: int = 1000, hours: Optional[int] = None) -> pd.DataFrame:
        """Get recent packets for retraining"""
        cursor = self.conn.cursor()
        
        query = "SELECT * FROM packets WHERE 1=1"
        params = []
        
        if hours:
            query += " AND timestamp >= datetime('now', '-' || ? || ' hours')"
            params.append(hours)
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(n)
        
        df = pd.read_sql_query(query, self.conn, params=params)
        return df
    
    def get_labeled_data(self, min_samples: int = 100) -> pd.DataFrame:
        """Get labeled data for supervised learning"""
        query = """
            SELECT p.*, GROUP_CONCAT(f.feature_name || ':' || f.feature_value) as feature_string
            FROM packets p
            LEFT JOIN features f ON p.id = f.packet_id
            WHERE p.label IS NOT NULL
            GROUP BY p.id
            LIMIT ?
        """
        
        df = pd.read_sql_query(query, self.conn, params=[min_samples * 10])
        return df
    
    def mark_verified(self, packet_id: int, verified: bool = True):
        """Mark a packet as verified"""
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE packets SET is_verified = ? WHERE id = ?
        """, (1 if verified else 0, packet_id))
        self.conn.commit()
    
    def get_statistics(self) -> Dict:
        """Get storage statistics"""
        cursor = self.conn.cursor()
        
        stats = {}
        
        # Total packets
        cursor.execute("SELECT COUNT(*) FROM packets")
        stats['total_packets'] = cursor.fetchone()[0]
        
        # Labeled packets
        cursor.execute("SELECT COUNT(*) FROM packets WHERE label IS NOT NULL")
        stats['labeled_packets'] = cursor.fetchone()[0]
        
        # Verified packets
        cursor.execute("SELECT COUNT(*) FROM packets WHERE is_verified = 1")
        stats['verified_packets'] = cursor.fetchone()[0]
        
        # Label distribution
        cursor.execute("""
            SELECT label, COUNT(*) as count
            FROM packets
            WHERE label IS NOT NULL
            GROUP BY label
        """)
        stats['label_distribution'] = dict(cursor.fetchall())
        
        return stats
    
    def cleanup_old_data(self, days: int = 30):
        """Remove data older than specified days"""
        cursor = self.conn.cursor()
        cursor.execute("""
            DELETE FROM packets
            WHERE timestamp < datetime('now', '-' || ? || ' days')
        """, (days,))
        
        deleted = cursor.rowcount
        self.conn.commit()
        logger.info(f"Cleaned up {deleted} old records")
        return deleted
    
    def close(self):
        """Close database connection"""
        self.conn.close()


def main():
    """Main entry point for testing"""
    storage = IncrementalStorage()
    
    # Test storage
    test_features = {
        'packet_size': 1500,
        'src_port': 443,
        'dst_port': 80,
        'protocol': 'TCP'
    }
    
    storage.store_packet(
        features=test_features,
        label='normal',
        prediction='normal',
        confidence=0.95
    )
    
    # Get statistics
    stats = storage.get_statistics()
    logger.info(f"Storage statistics: {stats}")
    
    storage.close()


if __name__ == "__main__":
    main()

