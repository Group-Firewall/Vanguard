"""Pydantic schemas for API request/response validation"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class PacketSchema(BaseModel):
    """Packet data schema"""
    id: Optional[int] = None
    timestamp: datetime
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    packet_size: int
    features: Optional[Dict[str, Any]] = None


class AlertSchema(BaseModel):
    """Alert schema"""
    id: Optional[int] = None
    timestamp: datetime
    severity: str
    alert_type: str
    source_ip: str
    destination_ip: str
    protocol: str
    description: str
    threat_score: float
    signature_match: bool
    ml_prediction: float
    hybrid_score: float
    resolved: bool = False
    alert_metadata: Optional[Dict[str, Any]] = None


class AlertCreate(BaseModel):
    """Alert creation schema"""
    severity: str
    alert_type: str
    source_ip: str
    destination_ip: str
    protocol: str
    description: str
    threat_score: float
    signature_match: bool = False
    ml_prediction: float = 0.0
    hybrid_score: float = 0.0
    alert_metadata: Optional[Dict[str, Any]] = None


class AlertResponse(BaseModel):
    """Alert response schema"""
    id: int
    timestamp: datetime
    severity: str
    alert_type: str
    source_ip: str
    destination_ip: str
    protocol: str
    description: str
    threat_score: float
    signature_match: bool
    ml_prediction: float
    hybrid_score: float
    resolved: bool
    alert_metadata: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class MetricsResponse(BaseModel):
    """Metrics response schema"""
    timestamp: datetime
    packet_volume: int
    attack_rate: float
    false_positive_rate: float
    model_confidence: Dict[str, float]
    throughput: float
    latency_ms: float


class FeatureImportanceResponse(BaseModel):
    """Feature importance response schema"""
    model_name: str
    features: List[Dict[str, Any]]
    shap_values: Optional[Dict[str, List[float]]] = None


class ModelRetrainRequest(BaseModel):
    """Model retraining request schema"""
    model_type: str  # supervised, unsupervised, hybrid, all
    force: bool = False


class CaptureStartRequest(BaseModel):
    """Packet capture start request"""
    interface: Optional[str] = None
    filter: Optional[str] = None


class CaptureStatusResponse(BaseModel):
    """Capture status response"""
    is_capturing: bool
    packets_captured: int
    start_time: Optional[datetime] = None
    interface: Optional[str] = None


class PredictionRequest(BaseModel):
    """Prediction request schema"""
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    packet_size: int
    tcp_flags: Optional[str] = None


class PredictionResponse(BaseModel):
    """Prediction response schema"""
    is_malicious: bool
    threat_score: float
    severity: str
    detection_method: str
    confidence: float
    signature_match: bool
    ml_prediction: float
    anomaly_score: float
    hybrid_score: float
    timestamp: datetime


class BatchPredictionRequest(BaseModel):
    """Batch prediction request"""
    packets: List[PredictionRequest]


class TrainRequest(BaseModel):
    """Model training request"""
    model_type: str = "all"  # supervised, unsupervised, hybrid, all
    force: bool = False


class LogEntry(BaseModel):
    """Log entry schema"""
    id: int
    timestamp: datetime
    severity: str
    alert_type: str
    source_ip: str
    destination_ip: str
    protocol: str
    description: str
    threat_score: float
    resolved: bool


class LogsResponse(BaseModel):
    """Logs response schema"""
    logs: List[LogEntry]
    total: int
    filtered: int


class HealthResponse(BaseModel):
    """Health check response"""
    status: str  # healthy, degraded, unhealthy
    timestamp: datetime
    database: str
    models: Dict[str, Any]
    statistics: Dict[str, Any]
    error: Optional[str] = None


class UserBase(BaseModel):
    """User base schema"""
    username: str
    email: str
    full_name: Optional[str] = None


class UserCreate(UserBase):
    """User creation schema"""
    password: str


class User(UserBase):
    """User response schema"""
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Token response schema"""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Token payload data schema"""
    username: Optional[str] = None
