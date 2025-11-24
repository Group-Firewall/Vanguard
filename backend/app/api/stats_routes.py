"""Statistics and analytics routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, List
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Alert, Metric, ModelPerformance

router = APIRouter()


@router.get("/stats/overview")
async def get_stats_overview(db: Session = Depends(get_db)):
    """Get comprehensive statistics overview"""
    try:
        # Time ranges
        now = datetime.now()
        last_hour = now - timedelta(hours=1)
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)
        
        # Alert statistics
        total_alerts = db.query(Alert).count()
        alerts_last_hour = db.query(Alert).filter(Alert.timestamp >= last_hour).count()
        alerts_last_24h = db.query(Alert).filter(Alert.timestamp >= last_24h).count()
        alerts_last_7d = db.query(Alert).filter(Alert.timestamp >= last_7d).count()
        
        # Severity breakdown
        severity_counts = db.query(
            Alert.severity,
            func.count(Alert.id).label('count')
        ).filter(
            Alert.timestamp >= last_24h
        ).group_by(Alert.severity).all()
        
        severity_breakdown = {severity: count for severity, count in severity_counts}
        
        # Alert type breakdown
        alert_type_counts = db.query(
            Alert.alert_type,
            func.count(Alert.id).label('count')
        ).filter(
            Alert.timestamp >= last_24h
        ).group_by(Alert.alert_type).all()
        
        alert_type_breakdown = {alert_type: count for alert_type, count in alert_type_counts}
        
        # Top source IPs
        top_sources = db.query(
            Alert.source_ip,
            func.count(Alert.id).label('count')
        ).filter(
            Alert.timestamp >= last_24h
        ).group_by(Alert.source_ip).order_by(
            func.count(Alert.id).desc()
        ).limit(10).all()
        
        top_source_ips = [{'ip': ip, 'count': count} for ip, count in top_sources]
        
        # Packet volume
        packet_volume_24h = db.query(func.sum(Metric.value)).filter(
            Metric.metric_type == 'packet_volume',
            Metric.timestamp >= last_24h
        ).scalar() or 0
        
        # Model performance
        recent_performance = db.query(ModelPerformance).order_by(
            ModelPerformance.timestamp.desc()
        ).limit(4).all()
        
        model_performance = [
            {
                'model_name': perf.model_name,
                'accuracy': perf.accuracy,
                'f1_score': perf.f1_score,
                'precision': perf.precision,
                'recall': perf.recall
            }
            for perf in recent_performance
        ]
        
        return {
            'alerts': {
                'total': total_alerts,
                'last_hour': alerts_last_hour,
                'last_24h': alerts_last_24h,
                'last_7d': alerts_last_7d
            },
            'severity_breakdown': severity_breakdown,
            'alert_type_breakdown': alert_type_breakdown,
            'top_source_ips': top_source_ips,
            'packet_volume_24h': float(packet_volume_24h),
            'model_performance': model_performance,
            'timestamp': now.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")


@router.get("/stats/timeline")
async def get_stats_timeline(
    hours: int = 24,
    interval_minutes: int = 60,
    db: Session = Depends(get_db)
):
    """Get timeline statistics for charts"""
    try:
        now = datetime.now()
        start_time = now - timedelta(hours=hours)
        
        # Group alerts by time intervals
        timeline_data = []
        current_time = start_time
        
        while current_time < now:
            interval_end = current_time + timedelta(minutes=interval_minutes)
            
            alerts_count = db.query(Alert).filter(
                Alert.timestamp >= current_time,
                Alert.timestamp < interval_end
            ).count()
            
            high_severity = db.query(Alert).filter(
                Alert.timestamp >= current_time,
                Alert.timestamp < interval_end,
                Alert.severity.in_(['high', 'critical'])
            ).count()
            
            packet_volume = db.query(func.sum(Metric.value)).filter(
                Metric.metric_type == 'packet_volume',
                Metric.timestamp >= current_time,
                Metric.timestamp < interval_end
            ).scalar() or 0
            
            timeline_data.append({
                'time': current_time.isoformat(),
                'time_label': current_time.strftime('%H:%M'),
                'alerts': alerts_count,
                'high_severity': high_severity,
                'packet_volume': float(packet_volume),
                'attack_rate': (alerts_count / max(packet_volume, 1)) * 100 if packet_volume > 0 else 0
            })
            
            current_time = interval_end
        
        return {
            'timeline': timeline_data,
            'interval_minutes': interval_minutes,
            'hours': hours
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching timeline: {str(e)}")

