"""Services for generating capture reports from real traffic.

These reports summarize packets and alerts seen over a recent time window and
are stored on disk so operators can review them later.
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any
import json
import csv

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Packet, Alert


def _build_summary(packets, alerts, now: datetime, window_minutes: int) -> Dict[str, Any]:
    """Build an in-memory summary structure for JSON export."""
    now = datetime.now()
    packet_sizes = [p.packet_size for p in packets if p.packet_size is not None]
    packet_count = len(packets)
    alert_count = len(alerts)

    # Per-severity breakdown
    severity_counts: Dict[str, int] = {}
    for a in alerts:
        if not a.severity:
            continue
        severity_counts[a.severity] = severity_counts.get(a.severity, 0) + 1

    # Top talkers (by source IP)
    src_counts: Dict[str, int] = {}
    for p in packets:
        if p.src_ip:
            src_counts[p.src_ip] = src_counts.get(p.src_ip, 0) + 1
    top_sources = sorted(src_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]

    # Protocol distribution
    proto_counts: Dict[str, int] = {}
    for p in packets:
        if p.protocol:
            proto_counts[p.protocol] = proto_counts.get(p.protocol, 0) + 1

    # Summary structure
    return {
        "generated_at": now.isoformat(),
        "window_minutes": window_minutes,
        "packet_count": packet_count,
        "alert_count": alert_count,
        "stats": {
            "min_packet_size": min(packet_sizes) if packet_sizes else 0,
            "max_packet_size": max(packet_sizes) if packet_sizes else 0,
            "avg_packet_size": (
                sum(packet_sizes) / len(packet_sizes) if packet_sizes else 0
            ),
        },
        "severity_breakdown": severity_counts,
        "top_sources": [
            {"src_ip": ip, "packet_count": count} for ip, count in top_sources
        ],
        "protocol_distribution": proto_counts,
        # Sample a limited number of recent alerts to keep reports compact
        "alerts_sample": [
            {
                "id": a.id,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "severity": a.severity,
                "alert_type": a.alert_type,
                "source_ip": a.source_ip,
                "destination_ip": a.destination_ip,
                "protocol": a.protocol,
                "description": a.description,
                "threat_score": a.threat_score,
                "hybrid_score": a.hybrid_score,
            }
            for a in alerts[-100:]
        ],
    }

def _write_csv_reports(
    reports_dir: Path, base_name: str, packets, alerts
) -> None:
    """Write CSV exports for packets and alerts for further analysis."""
    # Packets CSV
    packets_path = reports_dir / f"{base_name}_packets.csv"
    with packets_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "id",
                "timestamp",
                "src_ip",
                "dst_ip",
                "src_port",
                "dst_port",
                "protocol",
                "packet_size",
            ]
        )
        for p in packets:
            writer.writerow(
                [
                    p.id,
                    p.timestamp.isoformat() if p.timestamp else "",
                    p.src_ip,
                    p.dst_ip,
                    p.src_port,
                    p.dst_port,
                    p.protocol,
                    p.packet_size,
                ]
            )

    # Alerts CSV
    alerts_path = reports_dir / f"{base_name}_alerts.csv"
    with alerts_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "id",
                "timestamp",
                "severity",
                "alert_type",
                "source_ip",
                "destination_ip",
                "protocol",
                "description",
                "threat_score",
                "hybrid_score",
            ]
        )
        for a in alerts:
            writer.writerow(
                [
                    a.id,
                    a.timestamp.isoformat() if a.timestamp else "",
                    a.severity,
                    a.alert_type,
                    a.source_ip,
                    a.destination_ip,
                    a.protocol,
                    a.description,
                    a.threat_score,
                    a.hybrid_score,
                ]
            )


def generate_capture_report(db: Session, window_minutes: int = 10) -> str:
    """Generate a rich report (JSON + CSV) for recent captured traffic.

    Outputs under ``DATA_PATH/capture_reports``:
    - ``capture_report_<timestamp>.json``  (summary + breakdowns)
    - ``capture_report_<timestamp>_packets.csv``  (per-packet rows)
    - ``capture_report_<timestamp>_alerts.csv``   (per-alert rows)

    Returns the path to the JSON summary report.
    """
    now = datetime.now()
    since = now - timedelta(minutes=window_minutes)

    reports_dir = Path(settings.DATA_PATH) / "capture_reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    # Query recent packets and alerts
    packets = (
        db.query(Packet)
        .filter(Packet.timestamp >= since)
        .order_by(Packet.timestamp.asc())
        .all()
    )
    alerts = (
        db.query(Alert)
        .filter(Alert.timestamp >= since)
        .order_by(Alert.timestamp.asc())
        .all()
    )

    base_name = f"capture_report_{now.strftime('%Y%m%d_%H%M%S')}"

    # JSON summary
    report = _build_summary(packets, alerts, now, window_minutes)
    report_path = reports_dir / f"{base_name}.json"
    with report_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # CSV exports
    _write_csv_reports(reports_dir, base_name, packets, alerts)

    print(f"Capture report written to {report_path}")
    return str(report_path)

