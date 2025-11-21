"""ML-specific API routes for predictions and training"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import numpy as np

from app.database import get_db
from app import schemas
from app.services.ml_service import MLService
from app.models import Alert, Metric, ModelPerformance
from app.services.detection_engine import DetectionEngine
from app.services.feature_extraction import FeatureExtractionService

router = APIRouter()

# Initialize services
ml_service = MLService()
detection_engine = DetectionEngine()
feature_extractor = FeatureExtractionService()


@router.post("/predict", response_model=schemas.PredictionResponse)
async def predict(
    request: schemas.PredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Predict if network traffic is malicious
    
    Accepts packet features and returns prediction with threat score
    """
    try:
        # Extract features from request
        packet_features = {
            'src_ip': request.src_ip,
            'dst_ip': request.dst_ip,
            'src_port': request.src_port,
            'dst_port': request.dst_port,
            'protocol': request.protocol,
            'packet_size': request.packet_size,
            'timestamp': datetime.now()
        }
        
        # Add optional features
        if hasattr(request, 'tcp_flags') and request.tcp_flags:
            packet_features['tcp_flags'] = request.tcp_flags
        
        # Extract feature vector
        feature_vector = feature_extractor.extract_all_features(packet_features)
        
        # Run detection
        detection_result = detection_engine.detect_packet(packet_features)
        
        # Create alert if malicious
        if detection_result.get('is_malicious', False):
            from app.services.alert_manager import AlertManager
            alert_manager = AlertManager()
            alert_manager.create_alert(
                db,
                {
                    **detection_result,
                    'source_ip': request.src_ip,
                    'destination_ip': request.dst_ip,
                    'protocol': request.protocol
                }
            )
        
        return schemas.PredictionResponse(
            is_malicious=detection_result.get('is_malicious', False),
            threat_score=detection_result.get('threat_score', 0.0),
            severity=detection_result.get('severity', 'low'),
            detection_method=detection_result.get('detection_method', 'none'),
            confidence=detection_result.get('confidence', 0.0),
            signature_match=detection_result.get('signature_match', False),
            ml_prediction=detection_result.get('ml_prediction', 0.0),
            anomaly_score=detection_result.get('anomaly_score', 0.0),
            hybrid_score=detection_result.get('hybrid_score', 0.0),
            timestamp=datetime.now()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/predict/batch", response_model=List[schemas.PredictionResponse])
async def predict_batch(
    request: schemas.BatchPredictionRequest,
    db: Session = Depends(get_db)
):
    """Predict for multiple packets at once"""
    try:
        results = []
        for packet_data in request.packets:
            packet_features = {
                'src_ip': packet_data.src_ip,
                'dst_ip': packet_data.dst_ip,
                'src_port': packet_data.src_port,
                'dst_port': packet_data.dst_port,
                'protocol': packet_data.protocol,
                'packet_size': packet_data.packet_size,
                'timestamp': datetime.now()
            }
            
            detection_result = detection_engine.detect_packet(packet_features)
            
            results.append(schemas.PredictionResponse(
                is_malicious=detection_result.get('is_malicious', False),
                threat_score=detection_result.get('threat_score', 0.0),
                severity=detection_result.get('severity', 'low'),
                detection_method=detection_result.get('detection_method', 'none'),
                confidence=detection_result.get('confidence', 0.0),
                signature_match=detection_result.get('signature_match', False),
                ml_prediction=detection_result.get('ml_prediction', 0.0),
                anomaly_score=detection_result.get('anomaly_score', 0.0),
                hybrid_score=detection_result.get('hybrid_score', 0.0),
                timestamp=datetime.now()
            ))
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction error: {str(e)}")


@router.post("/train")
async def train_models(
    request: schemas.TrainRequest,
    background_tasks: BackgroundTasks
):
    """
    Train or retrain ML models
    
    Can train supervised, unsupervised, or hybrid models
    """
    try:
        background_tasks.add_task(
            ml_service.train_models,
            model_type=request.model_type,
            force=request.force
        )
        return {
            "message": f"Training {request.model_type} models started",
            "status": "training"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training error: {str(e)}")


@router.get("/logs", response_model=schemas.LogsResponse)
async def get_logs(
    limit: int = 100,
    severity: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """
    Get traffic logs and alerts
    
    Returns recent alerts and detection logs
    """
    try:
        query = db.query(Alert)
        
        if severity:
            query = query.filter(Alert.severity == severity)
        if start_date:
            query = query.filter(Alert.timestamp >= start_date)
        if end_date:
            query = query.filter(Alert.timestamp <= end_date)
        
        alerts = query.order_by(Alert.timestamp.desc()).limit(limit).all()
        
        return schemas.LogsResponse(
            logs=[
                {
                    "id": alert.id,
                    "timestamp": alert.timestamp,
                    "severity": alert.severity,
                    "alert_type": alert.alert_type,
                    "source_ip": alert.source_ip,
                    "destination_ip": alert.destination_ip,
                    "protocol": alert.protocol,
                    "description": alert.description,
                    "threat_score": alert.threat_score,
                    "resolved": alert.resolved
                }
                for alert in alerts
            ],
            total=len(alerts),
            filtered=len(alerts)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching logs: {str(e)}")


@router.get("/health", response_model=schemas.HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """
    System health check endpoint
    
    Returns system status, model status, and basic statistics
    """
    try:
        # Check database connection
        db_status = "healthy"
        try:
            db.execute("SELECT 1")
        except Exception:
            db_status = "unhealthy"
        
        # Check model status
        model_status = ml_service.get_model_status()
        
        # Get recent statistics
        recent_alerts = db.query(Alert).filter(
            Alert.timestamp >= datetime.now() - timedelta(hours=1)
        ).count()
        
        recent_packets = db.query(Metric).filter(
            Metric.timestamp >= datetime.now() - timedelta(hours=1),
            Metric.metric_type == "packet_volume"
        ).count()
        
        return schemas.HealthResponse(
            status="healthy" if db_status == "healthy" and model_status.get("hybrid_loaded", False) else "degraded",
            timestamp=datetime.now(),
            database=db_status,
            models=model_status,
            statistics={
                "alerts_last_hour": recent_alerts,
                "packets_last_hour": recent_packets
            }
        )
    except Exception as e:
        return schemas.HealthResponse(
            status="unhealthy",
            timestamp=datetime.now(),
            database="unknown",
            models={},
            statistics={},
            error=str(e)
        )

