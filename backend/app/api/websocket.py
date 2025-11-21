"""WebSocket handlers for real-time updates"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio
import logging

from app.services.packet_capture import PacketCaptureService
from app.services.detection_engine import DetectionEngine
from app.services.alert_manager import AlertManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connection. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        if not self.active_connections:
            return
        
        message_str = json.dumps(message)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


@router.websocket("/alerts")
async def websocket_alerts(websocket: WebSocket):
    """WebSocket endpoint for real-time alerts"""
    await manager.connect(websocket)
    
    try:
        while True:
            # Keep connection alive and wait for client messages
            data = await websocket.receive_text()
            # Echo back or handle client requests
            await websocket.send_text(json.dumps({"status": "connected"}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.websocket("/metrics")
async def websocket_metrics(websocket: WebSocket):
    """WebSocket endpoint for real-time metrics"""
    await manager.connect(websocket)
    
    try:
        while True:
            # Send periodic metrics updates
            await asyncio.sleep(1)  # Update every second
            
            # Get current metrics (simplified)
            metrics = {
                "timestamp": str(asyncio.get_event_loop().time()),
                "packet_count": 0,  # Would be populated from capture service
                "alert_count": 0,   # Would be populated from alert manager
            }
            
            await websocket.send_text(json.dumps(metrics))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


async def broadcast_alert(alert_data: dict):
    """Broadcast alert to all connected clients"""
    await manager.broadcast({
        "type": "alert",
        "data": alert_data
    })


async def broadcast_metrics(metrics_data: dict):
    """Broadcast metrics to all connected clients"""
    await manager.broadcast({
        "type": "metrics",
        "data": metrics_data
    })
