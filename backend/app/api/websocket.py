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

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.broadcaster import alert_broadcaster, metrics_broadcaster, packet_broadcaster

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# /ws/packets — raw live packet feed
# ---------------------------------------------------------------------------

@router.websocket("/packets")
async def ws_packets(websocket: WebSocket) -> None:
    """Live raw packet feed.

    Clients receive every captured packet with its ML classification
    result attached (is_intrusion, scan_type, threat_score).
    """
    await packet_broadcaster.connect(websocket)
    try:
        while True:
            # Keep the connection alive; data is pushed by the pipeline.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket /packets closed unexpectedly: %s", exc)
    finally:
        packet_broadcaster.disconnect(websocket)


# ---------------------------------------------------------------------------
# /ws/alerts — intrusion alerts only
# ---------------------------------------------------------------------------

@router.websocket("/alerts")
async def ws_alerts(websocket: WebSocket) -> None:
    """Intrusion alert feed — only packets classified as malicious.

    This channel has much lower volume than /ws/packets and is suitable
    for the alert centre and notification components.
    """
    await alert_broadcaster.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket /alerts closed unexpectedly: %s", exc)
    finally:
        alert_broadcaster.disconnect(websocket)


# ---------------------------------------------------------------------------
# /ws/metrics — periodic traffic statistics
# ---------------------------------------------------------------------------

@router.websocket("/metrics")
async def ws_metrics(websocket: WebSocket) -> None:
    """Periodic traffic statistics feed.

    The pipeline pushes a MetricsSnapshot every ~5 seconds.  This channel
    is suitable for the dashboard summary cards and throughput graphs.
    """
    await metrics_broadcaster.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket /metrics closed unexpectedly: %s", exc)
    finally:
        metrics_broadcaster.disconnect(websocket)


# ---------------------------------------------------------------------------
# Convenience broadcast helpers — kept for backward compatibility
# ---------------------------------------------------------------------------

async def broadcast_alert(alert_data: dict) -> None:
    """Broadcast an alert to all /ws/alerts subscribers."""
    await alert_broadcaster.broadcast({"type": "alert", "data": alert_data})


async def broadcast_metrics(metrics_data: dict) -> None:
    """Broadcast metrics to all /ws/metrics subscribers."""
    await metrics_broadcaster.broadcast({"type": "metrics", "data": metrics_data})


async def broadcast_packet(packet_data: dict) -> None:
    """Broadcast a packet to all /ws/packets subscribers."""
    await packet_broadcaster.broadcast({"type": "packet", "data": packet_data})
