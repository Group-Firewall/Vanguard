"""Statistics and analytics routes"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import json
import os

from app.database import get_db
from app.models import Alert, Metric, ModelPerformance
from app.config import settings

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


# =============================================================================
# Capture Reports API
# =============================================================================

def _get_reports_dir() -> Path:
    """Get the capture reports directory path."""
    return Path(settings.DATA_PATH) / "capture_reports"


@router.get("/reports/captures")
async def list_capture_reports(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50
):
    """List all available capture reports with optional date filtering.
    
    Query params:
    - start_date: Filter reports from this date (YYYY-MM-DD)
    - end_date: Filter reports until this date (YYYY-MM-DD)
    - limit: Maximum number of reports to return (default 50)
    """
    try:
        reports_dir = _get_reports_dir()
        
        if not reports_dir.exists():
            return {"reports": [], "total": 0}
        
        # Find all JSON report files
        report_files = list(reports_dir.glob("capture_report_*.json"))
        reports = []
        
        for report_path in report_files:
            # Extract timestamp from filename: capture_report_YYYYMMDD_HHMMSS.json
            filename = report_path.stem
            try:
                timestamp_str = filename.replace("capture_report_", "")
                report_date = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
            except ValueError:
                continue
            
            # Apply date filters
            if start_date:
                try:
                    start = datetime.strptime(start_date, "%Y-%m-%d")
                    if report_date < start:
                        continue
                except ValueError:
                    pass
            
            if end_date:
                try:
                    end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
                    if report_date >= end:
                        continue
                except ValueError:
                    pass
            
            # Load report summary
            try:
                with report_path.open("r", encoding="utf-8") as f:
                    report_data = json.load(f)
                
                # Check for associated CSV files
                packets_csv = reports_dir / f"{filename}_packets.csv"
                alerts_csv = reports_dir / f"{filename}_alerts.csv"
                
                reports.append({
                    "id": timestamp_str,
                    "timestamp": report_date.isoformat(),
                    "filename": report_path.name,
                    "packet_count": report_data.get("packet_count", 0),
                    "alert_count": report_data.get("alert_count", 0),
                    "window_minutes": report_data.get("window_minutes", 10),
                    "protocol_distribution": report_data.get("protocol_distribution", {}),
                    "severity_breakdown": report_data.get("severity_breakdown", {}),
                    "stats": report_data.get("stats", {}),
                    "has_packets_csv": packets_csv.exists(),
                    "has_alerts_csv": alerts_csv.exists(),
                    "file_size": report_path.stat().st_size
                })
            except (json.JSONDecodeError, IOError):
                continue
        
        # Sort by timestamp descending (newest first)
        reports.sort(key=lambda r: r["timestamp"], reverse=True)
        
        # Apply limit
        total = len(reports)
        reports = reports[:limit]
        
        return {
            "reports": reports,
            "total": total,
            "returned": len(reports)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing reports: {str(e)}")


@router.get("/reports/captures/{report_id}")
async def get_capture_report(report_id: str):
    """Get detailed capture report by ID (timestamp).
    
    The report_id is the timestamp in format YYYYMMDD_HHMMSS
    """
    try:
        reports_dir = _get_reports_dir()
        report_path = reports_dir / f"capture_report_{report_id}.json"
        
        if not report_path.exists():
            raise HTTPException(status_code=404, detail="Report not found")
        
        with report_path.open("r", encoding="utf-8") as f:
            report_data = json.load(f)
        
        # Add download URLs
        packets_csv = reports_dir / f"capture_report_{report_id}_packets.csv"
        alerts_csv = reports_dir / f"capture_report_{report_id}_alerts.csv"
        
        report_data["id"] = report_id
        report_data["downloads"] = {
            "json": f"/api/reports/captures/{report_id}/download/json",
            "packets_csv": f"/api/reports/captures/{report_id}/download/packets" if packets_csv.exists() else None,
            "alerts_csv": f"/api/reports/captures/{report_id}/download/alerts" if alerts_csv.exists() else None
        }
        
        return report_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching report: {str(e)}")


@router.get("/reports/captures/{report_id}/download/{file_type}")
async def download_capture_report(report_id: str, file_type: str):
    """Download a capture report file.
    
    file_type can be: json, packets, alerts
    """
    try:
        reports_dir = _get_reports_dir()
        
        if file_type == "json":
            file_path = reports_dir / f"capture_report_{report_id}.json"
            media_type = "application/json"
            filename = f"capture_report_{report_id}.json"
        elif file_type == "packets":
            file_path = reports_dir / f"capture_report_{report_id}_packets.csv"
            media_type = "text/csv"
            filename = f"capture_report_{report_id}_packets.csv"
        elif file_type == "alerts":
            file_path = reports_dir / f"capture_report_{report_id}_alerts.csv"
            media_type = "text/csv"
            filename = f"capture_report_{report_id}_alerts.csv"
        else:
            raise HTTPException(status_code=400, detail="Invalid file type. Use: json, packets, alerts")
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading report: {str(e)}")


@router.delete("/reports/captures/{report_id}")
async def delete_capture_report(report_id: str):
    """Delete a capture report and its associated files."""
    try:
        reports_dir = _get_reports_dir()
        
        files_deleted = []
        files_to_delete = [
            reports_dir / f"capture_report_{report_id}.json",
            reports_dir / f"capture_report_{report_id}_packets.csv",
            reports_dir / f"capture_report_{report_id}_alerts.csv"
        ]
        
        for file_path in files_to_delete:
            if file_path.exists():
                file_path.unlink()
                files_deleted.append(file_path.name)
        
        if not files_deleted:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return {
            "success": True,
            "deleted_files": files_deleted,
            "message": f"Deleted {len(files_deleted)} file(s)"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting report: {str(e)}")


@router.post("/reports/cleanup")
async def cleanup_old_reports(days_to_keep: int = 30):
    """Delete reports older than specified days (retention policy).
    
    Default retention: 30 days
    """
    try:
        reports_dir = _get_reports_dir()
        
        if not reports_dir.exists():
            return {"deleted_count": 0, "message": "No reports directory"}
        
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        deleted_count = 0
        
        report_files = list(reports_dir.glob("capture_report_*.json"))
        
        for report_path in report_files:
            filename = report_path.stem
            try:
                timestamp_str = filename.replace("capture_report_", "")
                report_date = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                
                if report_date < cutoff_date:
                    # Delete the report and associated files
                    report_path.unlink()
                    
                    packets_csv = reports_dir / f"{filename}_packets.csv"
                    alerts_csv = reports_dir / f"{filename}_alerts.csv"
                    
                    if packets_csv.exists():
                        packets_csv.unlink()
                    if alerts_csv.exists():
                        alerts_csv.unlink()
                    
                    deleted_count += 1
            except (ValueError, IOError):
                continue
        
        return {
            "deleted_count": deleted_count,
            "retention_days": days_to_keep,
            "cutoff_date": cutoff_date.isoformat(),
            "message": f"Deleted {deleted_count} report(s) older than {days_to_keep} days"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cleaning up reports: {str(e)}")
