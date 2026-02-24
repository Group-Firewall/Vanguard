"""Packet processing pipeline.

This module replaces the old DB-polling BackgroundProcessor.

Architecture
------------
The pipeline runs as a long-lived asyncio coroutine:

    packet_stream (asyncio.Queue)
        └─► drain up to BATCH_SIZE packets
                └─► batch feature extraction
                        └─► batch ML inference
                                ├─► packet_broadcaster  (/ws/packets)
                                ├─► alert_broadcaster   (/ws/alerts)
                                │       └─► AlertManager → DB (alerts only)
                                └─► metrics_broadcaster (/ws/metrics)  [periodic]

Key design decisions
--------------------
* Packets are processed in batches of 50-200 to amortise ML overhead.
* The DB is only written when an alert is created — never per-packet.
* Metrics are broadcast on a time-based schedule, not per-packet.
* Processing stops cleanly when stop() is called.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import List

from app.core.broadcaster import alert_broadcaster, metrics_broadcaster, packet_broadcaster
from app.core.stream import AlertData, MetricsSnapshot, PacketData, packet_stream
from app.database import SessionLocal
from app.services.alert_manager import AlertManager
from app.services.detection_engine import DetectionEngine

logger = logging.getLogger(__name__)

# Number of packets to accumulate before running a batch inference pass.
BATCH_SIZE: int = 100

# How often (in seconds) to emit a metrics snapshot.
METRICS_INTERVAL_SECONDS: float = 5.0


class PacketProcessingPipeline:
    """Async batch processing pipeline — consumes from packet_stream queue."""

    def __init__(self) -> None:
        self._detection_engine = DetectionEngine()
        self._alert_manager = AlertManager()
        self._is_running: bool = False

        # Counters for the metrics snapshot
        self._packets_captured: int = 0
        self._packets_processed: int = 0
        self._alerts_generated: int = 0
        self._malicious_count: int = 0

        self._last_metrics_time: datetime = datetime.now()
        self._last_second_count: int = 0
        self._packets_per_second: float = 0.0

    # ------------------------------------------------------------------
    # Public control
    # ------------------------------------------------------------------

    @property
    def is_running(self) -> bool:
        return self._is_running

    def stop(self) -> None:
        """Signal the pipeline to stop after the current batch."""
        self._is_running = False
        logger.info("Pipeline stop requested")

    # ------------------------------------------------------------------
    # Main async loop
    # ------------------------------------------------------------------

    async def run(self) -> None:
        """Continuously drain the queue and process in batches.

        This coroutine must be started via asyncio.create_task() so it
        runs concurrently with the FastAPI event loop.
        """
        self._is_running = True
        self._packets_captured = 0
        self._packets_processed = 0
        self._alerts_generated = 0
        self._malicious_count = 0
        self._last_metrics_time = datetime.now()

        logger.info("Processing pipeline started (batch_size=%d)", BATCH_SIZE)

        try:
            while self._is_running:
                batch = await self._drain_batch()

                if not batch:
                    # No packets yet — yield control briefly
                    await asyncio.sleep(0.05)
                    continue

                await self._process_batch(batch)

                # Emit a metrics update on schedule
                await self._maybe_broadcast_metrics()

        except asyncio.CancelledError:
            logger.info("Pipeline task was cancelled")
        except Exception as exc:
            logger.error("Unexpected pipeline error: %s", exc, exc_info=True)
        finally:
            self._is_running = False
            logger.info(
                "Pipeline stopped — processed=%d alerts=%d",
                self._packets_processed,
                self._alerts_generated,
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _drain_batch(self) -> List[PacketData]:
        """Collect up to BATCH_SIZE packets from the queue non-blockingly."""
        batch: List[PacketData] = []

        # Block for up to 0.5 s to get the first packet, then drain greedily
        try:
            first = await asyncio.wait_for(packet_stream.get(), timeout=0.5)
            batch.append(first)
            self._packets_captured += 1
        except asyncio.TimeoutError:
            return batch

        while len(batch) < BATCH_SIZE:
            try:
                packet_data = packet_stream.get_nowait()
                batch.append(packet_data)
                self._packets_captured += 1
            except asyncio.QueueEmpty:
                break

        return batch

    async def _process_batch(self, batch: List[PacketData]) -> None:
        """Run ML detection on a batch and broadcast results."""
        # Convert to plain dicts for the detection engine
        packet_dicts = [self._packet_data_to_feature_dict(p) for p in batch]

        # Batch ML inference — runs synchronously but is fast enough in-process
        detection_results = self._detection_engine.detect_batch(packet_dicts)

        db = SessionLocal()
        try:
            for packet_data, detection_result in zip(batch, detection_results):
                is_malicious = detection_result.get("is_malicious", False)

                # 1. Broadcast raw packet to /ws/packets (every packet)
                await packet_broadcaster.broadcast({
                    "type": "packet",
                    "data": {
                        **packet_data.to_dict(),
                        "is_intrusion": 1 if is_malicious else 0,
                        "scan_type": detection_result.get("attack_type", "Normal"),
                        "threat_score": detection_result.get("threat_score", 0.0),
                    },
                })

                # 2. Create and broadcast alert if malicious
                if is_malicious:
                    alert_payload = {
                        **detection_result,
                        "source_ip": packet_data.src_ip,
                        "destination_ip": packet_data.dst_ip,
                        "protocol": packet_data.protocol,
                    }
                    alert = self._alert_manager.create_alert(db, alert_payload)

                    if alert:
                        self._alerts_generated += 1
                        self._malicious_count += 1
                        alert_data = AlertData(
                            id=alert.id,
                            timestamp=alert.timestamp,
                            severity=alert.severity,
                            alert_type=alert.alert_type,
                            source_ip=alert.source_ip,
                            destination_ip=alert.destination_ip,
                            protocol=alert.protocol,
                            description=alert.description,
                            threat_score=alert.threat_score,
                        )
                        await alert_broadcaster.broadcast({
                            "type": "alert",
                            "data": alert_data.to_dict(),
                        })

                self._packets_processed += 1

        except Exception as exc:
            logger.error("Error processing batch: %s", exc, exc_info=True)
        finally:
            db.close()

    async def _maybe_broadcast_metrics(self) -> None:
        """Emit a MetricsSnapshot if enough time has elapsed."""
        now = datetime.now()
        elapsed = (now - self._last_metrics_time).total_seconds()

        if elapsed < METRICS_INTERVAL_SECONDS:
            return

        pps = (self._packets_processed - self._last_second_count) / max(elapsed, 1)
        self._packets_per_second = pps
        self._last_second_count = self._packets_processed
        self._last_metrics_time = now

        snapshot = MetricsSnapshot(
            timestamp=now,
            packets_captured=self._packets_captured,
            packets_processed=self._packets_processed,
            alerts_generated=self._alerts_generated,
            malicious_count=self._malicious_count,
            packets_per_second=pps,
        )

        await metrics_broadcaster.broadcast({
            "type": "metrics",
            "data": snapshot.to_dict(),
        })

    @staticmethod
    def _packet_data_to_feature_dict(packet_data: PacketData) -> dict:
        """Translate a PacketData into the dict shape expected by DetectionEngine."""
        return {
            "src_ip": packet_data.src_ip,
            "dst_ip": packet_data.dst_ip,
            "src_port": packet_data.src_port,
            "dst_port": packet_data.dst_port,
            "protocol": packet_data.protocol,
            "packet_size": packet_data.packet_size,
            "timestamp": packet_data.timestamp,
            "ip_ttl": packet_data.ip_ttl,
            "ip_len": packet_data.ip_len,
            "ip_flags": packet_data.ip_flags,
        }


# ---------------------------------------------------------------------------
# Global singleton — imported by routes.py and background_tasks.py
# ---------------------------------------------------------------------------

_pipeline: PacketProcessingPipeline = PacketProcessingPipeline()
_pipeline_task: asyncio.Task | None = None


async def start_pipeline() -> None:
    """Start the processing pipeline as an asyncio background task."""
    global _pipeline, _pipeline_task

    if _pipeline.is_running:
        logger.info("Pipeline is already running")
        return

    _pipeline = PacketProcessingPipeline()
    _pipeline_task = asyncio.create_task(_pipeline.run(), name="packet-pipeline")
    logger.info("Pipeline task created")


def stop_pipeline() -> None:
    """Request the pipeline to stop and cancel its asyncio task."""
    global _pipeline_task

    _pipeline.stop()

    if _pipeline_task and not _pipeline_task.done():
        _pipeline_task.cancel()
        logger.info("Pipeline task cancelled")


def get_pipeline() -> PacketProcessingPipeline:
    """Return the current pipeline instance (for status queries)."""
    return _pipeline
