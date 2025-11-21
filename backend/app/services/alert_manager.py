"""Alert management service"""
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Alert
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AlertManager:
    """Manage security alerts"""
    
    def __init__(self):
        self.alert_count = 0
        self.alert_rate_limiter = {}
    
    def create_alert(
        self,
        db: Session,
        detection_result: Dict,
        packet_id: Optional[int] = None
    ) -> Alert:
        """Create an alert from detection result"""
        # Rate limiting
        if not self._check_rate_limit(detection_result.get('source_ip', 'unknown')):
            logger.debug("Alert rate limited")
            return None
        
        # Determine alert type
        alert_type = self._determine_alert_type(detection_result)
        
        # Create alert
        alert = Alert(
            timestamp=datetime.now(),
            severity=detection_result.get('severity', 'low'),
            alert_type=alert_type,
            source_ip=detection_result.get('source_ip', 'unknown'),
            destination_ip=detection_result.get('destination_ip', 'unknown'),
            protocol=detection_result.get('protocol', 'unknown'),
            description=self._generate_description(detection_result),
            threat_score=detection_result.get('threat_score', 0.0),
            signature_match=detection_result.get('signature_match', False),
            ml_prediction=detection_result.get('ml_prediction', 0.0),
            hybrid_score=detection_result.get('hybrid_score', 0.0),
            packet_id=packet_id,
            resolved=False,
            alert_metadata={
                'detection_method': detection_result.get('detection_method', 'unknown'),
                'anomaly_score': detection_result.get('anomaly_score', 0.0),
            }
        )
        
        db.add(alert)
        db.commit()
        db.refresh(alert)
        
        self.alert_count += 1
        logger.info(f"Created alert {alert.id}: {alert.severity} - {alert.description}")
        
        return alert
    
    def _check_rate_limit(self, source_ip: str) -> bool:
        """Check if alert rate limit is exceeded"""
        current_minute = datetime.now().replace(second=0, microsecond=0)
        
        if source_ip not in self.alert_rate_limiter:
            self.alert_rate_limiter[source_ip] = {
                'minute': current_minute,
                'count': 0
            }
        
        ip_limiter = self.alert_rate_limiter[source_ip]
        
        # Reset if new minute
        if ip_limiter['minute'] != current_minute:
            ip_limiter['minute'] = current_minute
            ip_limiter['count'] = 0
        
        # Check limit
        max_alerts = settings.MAX_ALERTS_PER_MINUTE
        if ip_limiter['count'] >= max_alerts:
            return False
        
        ip_limiter['count'] += 1
        return True
    
    def _determine_alert_type(self, detection_result: Dict) -> str:
        """Determine alert type from detection result"""
        if detection_result.get('signature_match'):
            return 'known_attack'
        elif detection_result.get('anomaly_score', 0) > 0.7:
            return 'zero_day'
        else:
            return 'suspicious'
    
    def _generate_description(self, detection_result: Dict) -> str:
        """Generate alert description"""
        method = detection_result.get('detection_method', 'unknown')
        severity = detection_result.get('severity', 'low')
        score = detection_result.get('threat_score', 0.0)
        
        if detection_result.get('signature_match'):
            sig_name = detection_result.get('signature_name', 'unknown signature')
            return f"Signature-based detection: {sig_name} (confidence: {score:.2f})"
        elif method == 'ml':
            return f"ML-based detection: Anomaly detected (score: {score:.2f}, severity: {severity})"
        elif method == 'hybrid':
            return f"Hybrid detection: Combined signature and ML detection (score: {score:.2f})"
        else:
            return f"Network anomaly detected (score: {score:.2f}, severity: {severity})"
    
    def get_alerts(
        self,
        db: Session,
        severity: Optional[str] = None,
        resolved: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Alert]:
        """Get alerts with filtering"""
        query = db.query(Alert)
        
        if severity:
            query = query.filter(Alert.severity == severity)
        if resolved is not None:
            query = query.filter(Alert.resolved == resolved)
        
        alerts = query.order_by(Alert.timestamp.desc()).offset(offset).limit(limit).all()
        return alerts
    
    def resolve_alert(self, db: Session, alert_id: int) -> bool:
        """Mark an alert as resolved"""
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return False
        
        alert.resolved = True
        alert.resolved_at = datetime.now()
        db.commit()
        
        logger.info(f"Alert {alert_id} resolved")
        return True
    
    def cleanup_old_alerts(self, db: Session, days: int = None):
        """Clean up old resolved alerts"""
        if days is None:
            days = settings.ALERT_RETENTION_DAYS
        
        cutoff_date = datetime.now() - timedelta(days=days)
        
        deleted = db.query(Alert).filter(
            Alert.resolved == True,
            Alert.resolved_at < cutoff_date
        ).delete()
        
        db.commit()
        logger.info(f"Cleaned up {deleted} old alerts")
        return deleted

