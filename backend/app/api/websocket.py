"""WebSocket endpoints — three dedicated channels.

Channel     Endpoint          Payload
-------     --------          -------
/ws/packets Live packet feed  PacketData + ML classification
/ws/alerts  Intrusion alerts  AlertData (malicious packets only)
/ws/metrics Traffic stats     MetricsSnapshot (periodic)

Each channel uses its own ChannelBroadcaster instance so frontend
components can subscribe independently and receive only the data they
need.

The pipeline (background_tasks.py) calls broadcaster.broadcast() to push
data into the connected clients.  These route handlers are purely
responsible for managing connection lifecycle.
"""
import asyncio

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.broadcaster import alert_broadcaster, metrics_broadcaster, packet_broadcaster

logger = logging.getLogger(__name__)

router = APIRouter()


# /ws/packets — raw live packet feed

@router.websocket("/packets")
async def ws_packets(websocket: WebSocket) -> None:
    await packet_broadcaster.connect(websocket)
    try:
        while True:
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        pass
    finally:
        packet_broadcaster.disconnect(websocket)


# /ws/alerts — intrusion alerts only

@router.websocket("/alerts")
async def ws_alerts(websocket: WebSocket) -> None:
    await alert_broadcaster.connect(websocket)
    try:
        while True:
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        pass
    finally:
        alert_broadcaster.disconnect(websocket)


# /ws/metrics — periodic traffic statistics
@router.websocket("/metrics")
async def ws_metrics(websocket: WebSocket) -> None:
    await metrics_broadcaster.connect(websocket)
    try:
        while True:
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        pass
    finally:
        metrics_broadcaster.disconnect(websocket)


# Convenience broadcast helpers — kept for backward compatibility
async def broadcast_alert(alert_data: dict) -> None:
    """Broadcast an alert to all /ws/alerts subscribers."""
    await alert_broadcaster.broadcast({"type": "alert", "data": alert_data})


async def broadcast_metrics(metrics_data: dict) -> None:
    """Broadcast metrics to all /ws/metrics subscribers."""
    await metrics_broadcaster.broadcast({"type": "metrics", "data": metrics_data})


async def broadcast_packet(packet_data: dict) -> None:
    """Broadcast a packet to all /ws/packets subscribers."""
    await packet_broadcaster.broadcast({"type": "packet", "data": packet_data})
