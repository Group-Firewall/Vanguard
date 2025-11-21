"""SQLAlchemy database models"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from app.database import Base
from datetime import datetime


class Packet(Base):
    """Raw packet data"""
    __tablename__ = "packets"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=func.now(), index=True)
    src_ip = Column(String(45), index=True)
    dst_ip = Column(String(45), index=True)
    src_port = Column(Integer)
    dst_port = Column(Integer)
    protocol = Column(String(10))
    packet_size = Column(Integer)
    raw_data = Column(Text)  # JSON string of packet features
    features = Column(JSON)  # Extracted features
    created_at = Column(DateTime, default=func.now())


class Alert(Base):
    """Security alerts"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=func.now(), index=True)
    severity = Column(String(20), index=True)  # low, medium, high, critical
    alert_type = Column(String(50))  # known_attack, zero_day, suspicious
    source_ip = Column(String(45), index=True)
    destination_ip = Column(String(45))
    protocol = Column(String(10))
    description = Column(Text)
    threat_score = Column(Float)
    signature_match = Column(Boolean, default=False)
    ml_prediction = Column(Float)  # ML confidence score
    hybrid_score = Column(Float)  # Combined score
    packet_id = Column(Integer)  # Reference to packet
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    alert_metadata = Column(JSON)  # Additional alert metadata
    created_at = Column(DateTime, default=func.now())


class Metric(Base):
    """System metrics"""
    __tablename__ = "metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=func.now(), index=True)
    metric_type = Column(String(50), index=True)  # packet_volume, attack_rate, etc.
    value = Column(Float)
    metric_metadata = Column(JSON)
    created_at = Column(DateTime, default=func.now())


class ModelPerformance(Base):
    """Model performance metrics"""
    __tablename__ = "model_performance"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=func.now(), index=True)
    model_name = Column(String(100), index=True)
    model_type = Column(String(50))  # supervised, unsupervised, hybrid
    precision = Column(Float)
    recall = Column(Float)
    f1_score = Column(Float)
    accuracy = Column(Float)
    false_positive_rate = Column(Float)
    roc_auc = Column(Float, nullable=True)
    pr_auc = Column(Float, nullable=True)
    latency_ms = Column(Float)
    memory_usage_mb = Column(Float)
    throughput_packets_per_sec = Column(Float)
    performance_metadata = Column(JSON)
    created_at = Column(DateTime, default=func.now())

