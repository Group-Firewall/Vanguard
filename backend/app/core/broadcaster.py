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

print("[DEBUG] broadcaster.py module loading", flush=True)


class ChannelBroadcaster:
    """Manages all WebSocket connections for a single named channel."""

    def __init__(self, channel_name: str) -> None:
        self.channel_name = channel_name
        self._connections: Set[WebSocket] = set()
        print(f"[DEBUG] Created ChannelBroadcaster instance for '{channel_name}' at {id(self)}", flush=True)

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket client."""
        print(f"[DEBUG] ChannelBroadcaster.connect called on {self.channel_name} instance {id(self)}", flush=True)
        await websocket.accept()
        self._connections.add(websocket)
        logger.info(
            "[%s] client connected — total=%d",
            self.channel_name,
            len(self._connections),
        )
        print(f"[BROADCASTER] {self.channel_name}: client connected, total={len(self._connections)}", flush=True)

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
            print(f"[BROADCASTER] {self.channel_name}: NO CLIENTS CONNECTED", flush=True)
            return

        message = json.dumps(payload)
        stale: list[WebSocket] = []
        
        print(f"[BROADCASTER] {self.channel_name}: broadcasting to {len(self._connections)} clients", flush=True)

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
print(f"[DEBUG] Created packet_broadcaster instance {id(packet_broadcaster)}", flush=True)

#: Intrusion alerts only → /ws/alerts
alert_broadcaster: ChannelBroadcaster = ChannelBroadcaster("alerts")
print(f"[DEBUG] Created alert_broadcaster instance {id(alert_broadcaster)}", flush=True)

#: Periodic traffic statistics → /ws/metrics
metrics_broadcaster: ChannelBroadcaster = ChannelBroadcaster("metrics")
print(f"[DEBUG] Created metrics_broadcaster instance {id(metrics_broadcaster)}", flush=True)

