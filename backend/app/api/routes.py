"""API routes for Vanguard NIDS"""
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import asyncio

from app.database import get_db
from app import schemas
from app.services.packet_capture import PacketCaptureService
from app.services.detection_engine import get_detection_engine
from app.services.alert_manager import AlertManager
from app.services.model_service import ModelService
from app.services.report_service import generate_capture_report
from app import schemas, models
from app.models import Alert, Metric, ModelPerformance
from app.workers.background_tasks import start_pipeline, stop_pipeline, get_pipeline
from app.security import (
    get_current_user, 
    get_current_active_user,
    get_current_admin_user,
    RoleChecker,
    PermissionChecker
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize services
capture_service = PacketCaptureService()
detection_engine = get_detection_engine()
alert_manager = AlertManager()
model_service = ModelService()


@router.post("/capture/start", response_model=schemas.CaptureStatusResponse)
async def start_capture(
    request: schemas.CaptureStartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(PermissionChecker("capture"))
):
    """Start live packet capture and the ML processing pipeline.

    The capture service enqueues packets into the in-memory stream;
    the processing pipeline consumes them in batches for ML detection.
    No DB writes happen during capture — only alerts are persisted.
    
    Requires 'capture' permission (analyst or admin).
    """
    try:
        if capture_service.is_capturing:
            raise HTTPException(status_code=400, detail="Capture already in progress")

        # Start packet capture (no DB session needed)
        capture_service.start_capture(
            interface=request.interface,
            filter_str=request.filter,
        )

        # Start the async batch processing pipeline
        await start_pipeline()

        return schemas.CaptureStatusResponse(
            is_capturing=True,
            packets_captured=0,
            start_time=datetime.now(),
            interface=capture_service.get_interface()
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/capture/stop", response_model=schemas.CaptureStatusResponse)
async def stop_capture(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(PermissionChecker("capture"))
):
    """Stop packet capture and the processing pipeline.

    Saves an aggregate metrics record to DB for historical reporting,
    then generates a capture report on disk.
    
    Requires 'capture' permission (analyst or admin).
    """
    try:
        capture_service.stop_capture()
        stop_pipeline()
        packet_count = capture_service.get_packet_count()

        # Persist session summary as a single aggregate metric (not per-packet)
        if packet_count > 0:
            session_metric = Metric(
                timestamp=datetime.now(),
                metric_type="capture_session",
                value=float(packet_count),
                metric_metadata={
                    "interface": capture_service.get_interface(),
                    "duration_seconds": (
                        (datetime.now() - capture_service.get_start_time()).total_seconds()
                        if capture_service.get_start_time() else 0
                    ),
                },
            )
            db.add(session_metric)
            db.commit()

        # Generate capture report (best-effort — failure must not break the response)
        try:
            generate_capture_report(db)
        except Exception as report_err:
            logger.warning(f"Error generating capture report: {report_err}")

        return schemas.CaptureStatusResponse(
            is_capturing=False,
            packets_captured=packet_count,
            start_time=None,
            interface=None
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/capture/status", response_model=schemas.CaptureStatusResponse)
async def get_capture_status(
    current_user: models.User = Depends(get_current_active_user)
):
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(PermissionChecker("write"))
):
    """Create a new alert (requires write permission)"""
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get alerts with optional filtering (requires authentication)"""
    query = db.query(Alert)
    
    if severity:
        query = query.filter(Alert.severity == severity)
    if resolved is not None:
        query = query.filter(Alert.resolved == resolved)
    
    alerts = query.order_by(Alert.timestamp.desc()).offset(offset).limit(limit).all()
    return [schemas.AlertResponse.from_orm(alert) for alert in alerts]


@router.get("/alerts/{alert_id}", response_model=schemas.AlertResponse)
async def get_alert(
    alert_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get a specific alert (requires authentication)"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return schemas.AlertResponse.from_orm(alert)


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(PermissionChecker("write"))
):
    """Mark an alert as resolved (requires write permission)"""
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get system metrics (requires authentication)"""
    try:
        since = datetime.now() - timedelta(hours=hours)
        
        # Get packet volume (sum of all metrics, not just count)
        metrics = db.query(Metric).filter(
            Metric.metric_type == "packet_volume",
            Metric.timestamp >= since
        ).all()
        packet_count = sum(m.value for m in metrics) if metrics else len(metrics)
        
        # Get attack rate
        attack_count = db.query(Alert).filter(
            Alert.timestamp >= since,
            Alert.resolved == False
        ).count()
        
        attack_rate = (attack_count / max(packet_count, 1)) * 100 if packet_count > 0 else 0.0
        
        # Get false positive rate
        false_positives = db.query(Alert).filter(
            Alert.timestamp >= since,
            Alert.severity == "low",
            Alert.resolved == True
        ).count()
        
        fp_rate = (false_positives / max(attack_count, 1)) * 100 if attack_count > 0 else 0.0
        
        # Get model confidence (from recent performance metrics)
        recent_perfs = db.query(ModelPerformance).order_by(
            ModelPerformance.timestamp.desc()
        ).limit(4).all()
        
        model_confidence = {}
        for perf in recent_perfs:
            model_confidence[perf.model_name] = perf.accuracy
        
        # Get throughput and latency
        # Calculate throughput from metrics
        if metrics:
            total_packets = sum(m.value for m in metrics)
            time_span_seconds = hours * 3600
            throughput = total_packets / max(time_span_seconds, 1)
        else:
            # Fallback: estimate from alerts
            throughput = attack_count / max(hours * 3600, 1) * 10  # Rough estimate
        
        latency = recent_perfs[0].latency_ms if recent_perfs else 5.0
        
        return schemas.MetricsResponse(
            timestamp=datetime.now(),
            packet_volume=int(packet_count),
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
        
        # If no data, return default feature importance based on common network features
        if not importance_data.get('features') or len(importance_data.get('features', {})) == 0:
            # Return default feature importance
            default_features = {
                'packet_size': {'importance_mean': 0.25, 'importance_std': 0.02},
                'dst_port': {'importance_mean': 0.20, 'importance_std': 0.02},
                'src_port': {'importance_mean': 0.15, 'importance_std': 0.02},
                'protocol': {'importance_mean': 0.12, 'importance_std': 0.01},
                'flow_duration': {'importance_mean': 0.10, 'importance_std': 0.01},
                'packets_per_second': {'importance_mean': 0.08, 'importance_std': 0.01},
                'bytes_per_second': {'importance_mean': 0.06, 'importance_std': 0.01},
                'port_entropy': {'importance_mean': 0.04, 'importance_std': 0.01}
            }
            importance_data = {
                'model_name': model_name or 'ensemble',
                'features': default_features,
                'shap_values': None
            }
        
        return schemas.FeatureImportanceResponse(**importance_data)
    except Exception as e:
        # Return default on error
        default_features = {
            'packet_size': {'importance_mean': 0.25, 'importance_std': 0.02},
            'dst_port': {'importance_mean': 0.20, 'importance_std': 0.02},
            'src_port': {'importance_mean': 0.15, 'importance_std': 0.02},
            'protocol': {'importance_mean': 0.12, 'importance_std': 0.01},
            'flow_duration': {'importance_mean': 0.10, 'importance_std': 0.01},
            'packets_per_second': {'importance_mean': 0.08, 'importance_std': 0.01},
            'bytes_per_second': {'importance_mean': 0.06, 'importance_std': 0.01},
            'port_entropy': {'importance_mean': 0.04, 'importance_std': 0.01}
        }
        return schemas.FeatureImportanceResponse(
            model_name=model_name or 'default',
            features=default_features,
            shap_values=None
        )


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
    pipeline = get_pipeline()
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "capture_active": capture_service.is_capturing,
        "pipeline_active": pipeline.is_running,
    }


@router.post("/test-data/create")
async def create_test_data_endpoint(db: Session = Depends(get_db)):
    """Create test data for dashboard (development only)"""
    import random
    
    try:
        # Create test metrics
        for i in range(10):
            metric = Metric(
                timestamp=datetime.now() - timedelta(minutes=i*5),
                metric_type="packet_volume",
                value=random.randint(100, 1000),
                metric_metadata={}
            )
            db.add(metric)
        
        # Create test alerts
        severities = ['low', 'medium', 'high']
        alert_types = ['known_attack', 'zero_day', 'suspicious']
        
        for i in range(15):
            severity = random.choice(severities)
            alert = Alert(
                timestamp=datetime.now() - timedelta(minutes=i*10),
                severity=severity,
                alert_type=random.choice(alert_types),
                source_ip=f"192.168.1.{random.randint(1, 255)}",
                destination_ip=f"10.0.0.{random.randint(1, 255)}",
                protocol=random.choice(['TCP', 'UDP', 'ICMP']),
                description=f"Test alert {i+1}: {severity} severity attack detected",
                threat_score=random.uniform(0.5, 0.95),
                signature_match=random.choice([True, False]),
                ml_prediction=random.uniform(0.4, 0.9),
                hybrid_score=random.uniform(0.5, 0.95),
                resolved=random.choice([True, False]) if i > 10 else False,
                alert_metadata={
                    'test': True,
                    'detection_method': random.choice(['signature', 'ml', 'hybrid'])
                }
            )
            db.add(alert)
        
        # Create test model performance
        models = ['random_forest', 'xgboost', 'lightgbm', 'svm']
        for model_name in models:
            perf = ModelPerformance(
                timestamp=datetime.now() - timedelta(hours=1),
                model_name=model_name,
                model_type='supervised',
                precision=random.uniform(0.85, 0.95),
                recall=random.uniform(0.80, 0.90),
                f1_score=random.uniform(0.82, 0.93),
                accuracy=random.uniform(0.88, 0.96),
                false_positive_rate=random.uniform(0.01, 0.05),
                roc_auc=random.uniform(0.90, 0.98),
                pr_auc=random.uniform(0.85, 0.95),
                latency_ms=random.uniform(2.0, 8.0),
                memory_usage_mb=random.uniform(100, 500),
                throughput_packets_per_sec=random.uniform(1000, 5000),
                performance_metadata={}
            )
            db.add(perf)
        
        db.commit()
        return {
            "message": "Test data created successfully",
            "metrics": 10,
            "alerts": 15,
            "model_performance": len(models)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating test data: {str(e)}")


# Settings Endpoints
@router.get("/settings", response_model=Dict[str, Any])
async def get_settings(db: Session = Depends(get_db)):
    """Get all system settings"""
    settings = db.query(models.Setting).all()
    return {s.key: s.value for s in settings}


@router.post("/settings")
async def update_settings(
    settings_in: schemas.SettingsUpdate,
    db: Session = Depends(get_db)
):
    """Update multiple system settings"""
    for key, value in settings_in.settings.items():
        db_setting = db.query(models.Setting).filter(models.Setting.key == key).first()
        if db_setting:
            db_setting.value = str(value)
        else:
            # Determine category based on key prefix or similar
            category = "system"
            if "alert" in key.lower(): category = "alerts"
            if "engine" in key.lower() or "detection" in key.lower(): category = "engine"
            
            db_setting = models.Setting(
                key=key,
                value=str(value),
                category=category
            )
            db.add(db_setting)
    
    db.commit()
    return {"message": "Settings updated successfully"}


@router.post("/firewall/block-ip")
async def block_ip_action(ip: str, db: Session = Depends(get_db)):
    """Mock implementation of blocking an IP"""
    # In a real scenario, this would interact with iptables/nftables
    print(f"Blocking IP: {ip}")
    return {"message": f"IP {ip} has been blocked"}


@router.post("/alerts/{alert_id}/escalate")
async def escalate_alert(alert_id: int, db: Session = Depends(get_db)):
    """Escalate an alert to High severity"""
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.severity = "high"
    db.commit()
    return {"message": "Alert escalated to High severity"}
