"""API routes for Vanguard NIDS"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app import schemas
from app.services.packet_capture import PacketCaptureService
from app.services.detection_engine import DetectionEngine
from app.services.alert_manager import AlertManager
from app.services.model_service import ModelService
from app.models import Alert, Metric, ModelPerformance

router = APIRouter()

# Initialize services
capture_service = PacketCaptureService()
detection_engine = DetectionEngine()
alert_manager = AlertManager()
model_service = ModelService()


@router.post("/capture/start", response_model=schemas.CaptureStatusResponse)
async def start_capture(
    request: schemas.CaptureStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start packet capture"""
    try:
        if capture_service.is_capturing:
            raise HTTPException(status_code=400, detail="Capture already in progress")
        
        interface = request.interface
        filter_str = request.filter
        
        # Start capture in background
        background_tasks.add_task(
            capture_service.start_capture,
            interface=interface,
            filter_str=filter_str,
            db=db
        )
        
        return schemas.CaptureStatusResponse(
            is_capturing=True,
            packets_captured=0,
            start_time=datetime.now(),
            interface=interface
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/capture/stop", response_model=schemas.CaptureStatusResponse)
async def stop_capture():
    """Stop packet capture"""
    try:
        capture_service.stop_capture()
        packet_count = capture_service.get_packet_count()
        return schemas.CaptureStatusResponse(
            is_capturing=False,
            packets_captured=packet_count,
            start_time=None,
            interface=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/capture/status", response_model=schemas.CaptureStatusResponse)
async def get_capture_status():
    """Get current capture status"""
    return schemas.CaptureStatusResponse(
        is_capturing=capture_service.is_capturing,
        packets_captured=capture_service.get_packet_count(),
        start_time=capture_service.get_start_time(),
        interface=capture_service.get_interface()
    )


@router.post("/alert", response_model=schemas.AlertResponse)
async def create_alert(
    alert: schemas.AlertCreate,
    db: Session = Depends(get_db)
):
    """Create a new alert"""
    try:
        # Convert schema to dict for detection result format
        detection_result = {
            'severity': alert.severity,
            'alert_type': alert.alert_type,
            'source_ip': alert.source_ip,
            'destination_ip': alert.destination_ip,
            'protocol': alert.protocol,
            'threat_score': alert.threat_score,
            'signature_match': alert.signature_match,
            'ml_prediction': alert.ml_prediction,
            'hybrid_score': alert.hybrid_score,
        }
        db_alert = alert_manager.create_alert(db, detection_result)
        return schemas.AlertResponse.from_orm(db_alert)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts", response_model=List[schemas.AlertResponse])
async def get_alerts(
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get alerts with optional filtering"""
    query = db.query(Alert)
    
    if severity:
        query = query.filter(Alert.severity == severity)
    if resolved is not None:
        query = query.filter(Alert.resolved == resolved)
    
    alerts = query.order_by(Alert.timestamp.desc()).offset(offset).limit(limit).all()
    return [schemas.AlertResponse.from_orm(alert) for alert in alerts]


@router.get("/alerts/{alert_id}", response_model=schemas.AlertResponse)
async def get_alert(alert_id: int, db: Session = Depends(get_db)):
    """Get a specific alert"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return schemas.AlertResponse.from_orm(alert)


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    """Mark an alert as resolved"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.resolved = True
    alert.resolved_at = datetime.now()
    db.commit()
    return {"message": "Alert resolved"}


@router.get("/metrics", response_model=schemas.MetricsResponse)
async def get_metrics(
    hours: int = 1,
    db: Session = Depends(get_db)
):
    """Get system metrics"""
    try:
        since = datetime.now() - timedelta(hours=hours)
        
        # Get packet volume
        packet_count = db.query(Metric).filter(
            Metric.metric_type == "packet_volume",
            Metric.timestamp >= since
        ).count()
        
        # Get attack rate
        attack_count = db.query(Alert).filter(
            Alert.timestamp >= since,
            Alert.resolved == False
        ).count()
        
        attack_rate = (attack_count / max(packet_count, 1)) * 100
        
        # Get false positive rate
        false_positives = db.query(Alert).filter(
            Alert.timestamp >= since,
            Alert.severity == "low",
            Alert.resolved == True
        ).count()
        
        fp_rate = (false_positives / max(attack_count, 1)) * 100
        
        # Get model confidence (from recent performance metrics)
        recent_perf = db.query(ModelPerformance).order_by(
            ModelPerformance.timestamp.desc()
        ).first()
        
        model_confidence = {}
        if recent_perf:
            model_confidence = {
                recent_perf.model_name: recent_perf.accuracy
            }
        
        # Get throughput and latency
        throughput = packet_count / max(hours * 3600, 1)
        latency = recent_perf.latency_ms if recent_perf else 0.0
        
        return schemas.MetricsResponse(
            timestamp=datetime.now(),
            packet_volume=packet_count,
            attack_rate=attack_rate,
            false_positive_rate=fp_rate,
            model_confidence=model_confidence,
            throughput=throughput,
            latency_ms=latency
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feature-importance", response_model=schemas.FeatureImportanceResponse)
async def get_feature_importance(
    model_name: Optional[str] = None
):
    """Get feature importance for models"""
    try:
        importance_data = model_service.get_feature_importance(model_name)
        return schemas.FeatureImportanceResponse(**importance_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/model/retrain")
async def retrain_model(
    request: schemas.ModelRetrainRequest,
    background_tasks: BackgroundTasks
):
    """Retrain ML models"""
    try:
        background_tasks.add_task(
            model_service.retrain_models,
            model_type=request.model_type,
            force=request.force
        )
        return {"message": f"Retraining {request.model_type} models started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "capture_active": capture_service.is_capturing
    }

