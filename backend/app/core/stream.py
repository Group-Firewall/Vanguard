"""In-memory packet stream.

This module owns the single shared asyncio.Queue that decouples the
packet capture layer from the ML processing pipeline.

Architecture
------------
PacketCaptureService.enqueue_packet()
    └─► packet_stream (asyncio.Queue)
            └─► PacketProcessingPipeline.run()
                    ├─► /ws/packets  (raw live feed)
                    ├─► /ws/alerts   (ML-detected threats)
                    └─► /ws/metrics  (traffic statistics)
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------------------------
# Shared in-memory queue
# ---------------------------------------------------------------------------

# maxsize = 5000 ensures the capture thread never blocks the event loop.
# If the processing pipeline falls behind, older packets are silently
# dropped via put_nowait() rather than stalling packet capture.
packet_stream: asyncio.Queue = asyncio.Queue(maxsize=5_000)


# ---------------------------------------------------------------------------
# Typed payloads shared between services
# ---------------------------------------------------------------------------

@dataclass
class PacketData:
    """Minimal, ML-ready representation of a captured network packet.

    Capture is intentionally "dumb": it only extracts what is visible at
    the wire level.  Feature engineering happens downstream in the
    processing pipeline.
    """

    timestamp: datetime
    src_ip: str
    dst_ip: str
    protocol: str
    packet_size: int
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    ip_ttl: Optional[int] = None
    ip_len: Optional[int] = None
    ip_flags: Optional[str] = None
    raw_summary: str = ""

    def to_dict(self) -> dict:
        """Serialise to a JSON-safe dictionary for WebSocket broadcast."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "src_ip": self.src_ip,
            "dst_ip": self.dst_ip,
            "src_port": self.src_port,
            "dst_port": self.dst_port,
            "protocol": self.protocol,
            "packet_size": self.packet_size,
            "ip_ttl": self.ip_ttl,
            "ip_flags": self.ip_flags,
            "raw_summary": self.raw_summary,
        }


@dataclass
class AlertData:
    """Detection result broadcast payload for the /ws/alerts channel."""

    id: Optional[int]
    timestamp: datetime
    severity: str
    alert_type: str
    source_ip: str
    destination_ip: str
    protocol: str
    description: str
    threat_score: float

    def to_dict(self) -> dict:
        """Serialise for WebSocket broadcast."""
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "severity": self.severity,
            "alert_type": self.alert_type,
            "source_ip": self.source_ip,
            "destination_ip": self.destination_ip,
            "protocol": self.protocol,
            "description": self.description,
            "threat_score": self.threat_score,
        }


@dataclass
class MetricsSnapshot:
    """Periodic traffic statistics for the /ws/metrics channel."""

    timestamp: datetime
    packets_captured: int
    packets_processed: int
    alerts_generated: int
    malicious_count: int
    packets_per_second: float

    def to_dict(self) -> dict:
        """Serialise for WebSocket broadcast."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "packets_captured": self.packets_captured,
            "packets_processed": self.packets_processed,
            "alerts_generated": self.alerts_generated,
            "malicious_count": self.malicious_count,
            "packets_per_second": round(float(self.packets_per_second), 2),
        }
