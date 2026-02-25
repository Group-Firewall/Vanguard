"""Per-channel WebSocket broadcaster.

Each channel (/ws/packets, /ws/alerts, /ws/metrics) has its own
ChannelBroadcaster instance.  Connections to different channels are
completely independent so frontend components only receive the data
they subscribe to.

Design goals
------------
* Thread-safe connection management via a regular set.
* Stale / disconnected clients are pruned during broadcast silently.
* Broadcast is fire-and-forget: slow clients do not block the pipeline.
"""

from __future__ import annotations

import json
import logging
from typing import Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ChannelBroadcaster:
    """Manages all WebSocket connections for a single named channel."""

    def __init__(self, channel_name: str) -> None:
        self.channel_name = channel_name
        self._connections: Set[WebSocket] = set()

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket client."""
        await websocket.accept()
        self._connections.add(websocket)
        logger.info(
            "[%s] client connected — total=%d",
            self.channel_name,
            len(self._connections),
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket client (idempotent)."""
        self._connections.discard(websocket)
        logger.info(
            "[%s] client disconnected — total=%d",
            self.channel_name,
            len(self._connections),
        )

    # ------------------------------------------------------------------
    # Broadcasting
    # ------------------------------------------------------------------

    async def broadcast(self, payload: dict) -> None:
        """Send *payload* as JSON to every connected client.

        Clients that have disconnected are pruned without raising
        exceptions so the calling pipeline is never interrupted.
        """
        if not self._connections:
            return

        message = json.dumps(payload)
        stale: list[WebSocket] = []

        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)

        for ws in stale:
            self.disconnect(ws)

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    @property
    def client_count(self) -> int:
        """Number of currently connected clients."""
        return len(self._connections)


# ---------------------------------------------------------------------------
# Singleton broadcaster instances — one per WebSocket channel
# ---------------------------------------------------------------------------

#: Raw, live packet feed → /ws/packets
packet_broadcaster: ChannelBroadcaster = ChannelBroadcaster("packets")

#: Intrusion alerts only → /ws/alerts
alert_broadcaster: ChannelBroadcaster = ChannelBroadcaster("alerts")

#: Periodic traffic statistics → /ws/metrics
metrics_broadcaster: ChannelBroadcaster = ChannelBroadcaster("metrics")
