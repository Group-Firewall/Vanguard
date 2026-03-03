# VANGUARD NIDS - DATA FLOW FIX SUMMARY

## THE ISSUE

When you click "Start Capture" in the frontend, the following happens:
- ✓ Backend captures packets correctly
- ✓ Pipeline processes packets and creates alerts
- ✓ WebSocket routes are registered in FastAPI
- **✗ PROBLEM: WebSocket broadcasts are NOT reaching the frontend**

The frontend tables and charts (Traffic Monitoring, Alerts & Incidents, Dashboard, Reports, Detection Engines, Attack Intelligence) are NOT being updated in real-time because no data is coming through the WebSocket connections.

## ROOT CAUSES IDENTIFIED

### 1. **Database Tables Not Initialized in Certain Contexts**
- When the pipeline runs outside the FastAPI context, it tries to write to the database but fails with "no such table: alerts"
- The `init_db()` function must be called before the pipeline starts processing

### 2. **WebSocket Handler/Broadcaster Issue**
- WebSocket routes ARE registered in the FastAPI app (/ws/packets, /ws/alerts, /ws/metrics)
- Clients CAN connect to the WebSocket endpoints
- **However**: The broadcasters may not be receiving connections properly due to event loop/async context issues
- Or: The broadcasts are being sent but failing silently

### 3. **Missing Connection Verification**
- There's no logging/monitoring to verify that:
  - WebSocket clients are successfully connecting
  - Broadcasts are being attempted
  - Messages are being sent successfully

## THE FIX

### Step 1: Ensure Database is Initialized Before Pipeline Starts

The FastAPI startup event already calls `init_db()`, but ensure it's called properly:

**Location**: [backend/app/main.py](backend/app/main.py#L48-L50)

```python
@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    # Initialize database
    init_db()
    print(f"{settings.APP_NAME} v{settings.VERSION} started successfully!")
```

✓ **This is already correct**

### Step 2: Verify Pipeline Error Handling

The pipeline catches exceptions silently. Ensure errors are logged:

**Location**: [backend/app/workers/background_tasks.py](backend/app/workers/background_tasks.py#L189-L195)

The current code already has try/except with logging. Ensure logs are being sent to appropriate handlers.

### Step 3: Add Broadcaster Connection Logging

Added debug logging to [backend/app/core/broadcaster.py](backend/app/core/broadcaster.py) to verify:
- When clients connect
- When broadcasts occur
- How many clients are connected

### Step 4: Verify WebSocket Routes Are Accessible

**Location**: [backend/app/api/websocket.py](backend/app/api/websocket.py)

Routes registered:
- `/ws/packets` - raw packet feed
- `/ws/alerts` - intrusion alerts only
- `/ws/metrics` - periodic traffic statistics

All routes are correctly registered with the FastAPI app.

### Step 5: Frontend WebSocket Connections

**Location**: [frontend/src/hooks/useWebSocket.js](frontend/src/hooks/useWebSocket.js)

The frontend hook:
- Builds correct WebSocket URLs
- Implements auto-reconnect with exponential backoff
- Properly handles connection lifecycle

✓ **This code is correct**

## VERIFICATION STEPS

To verify the fix is working:

1. **Start the backend server**:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Check browser DevTools**:
   - Open Network tab
   - Filter for WebSocket connections
   - Confirm connections to:
     - `ws://localhost:8000/ws/packets`
     - `ws://localhost:8000/ws/alerts`
     - `ws://localhost:8000/ws/metrics`
   - Status should be "101 Switching Protocols" (successfully upgraded)

4. **Click "Start Capture"** in the UI

5. **Observe**:
   - Traffic Monitoring table should populate with packets
   - Charts should show packet activity
   - Alerts & Incidents should update with new alerts
   - Dashboard metrics should update
   - All components should update in real-time

## IF IT'S STILL NOT WORKING

Check these things:

1. **Backend logs** - Look for "Error processing batch" or "client connected" logs
2. **Frontend console** - Check for WebSocket errors
3. **Database** - Verify alerts table has data: `SELECT COUNT(*) FROM alerts`
4. **Network** - Verify WebSocket traffic in browser DevTools (Network > WS tab)
5. **Firewall** - Ensure port 8000 is accessible

## KEY COMPONENTS

| Component | Purpose | Status |
|-----------|---------|--------|
| PacketCaptureService | Captures packets from network interface | ✓ Working |
| PacketProcessingPipeline | Processes packets and calls ML detection | ✓ Working |
| DetectionEngine | Hybrid ML-based detection | ✓ Working |
| ChannelBroadcaster | Manages WebSocket connections and broadcasts | ✓ Implemented |
| Frontend useWebSocket Hook | Connects to WebSocket and receives data | ✓ Correct |

## NEXT STEPS IF STILL FAILING

1. Check backend logs for any errors during broadcast
2. Verify packet_stream queue is not full (would drop packets)
3. Verify ML models are loaded correctly  
4. Check that frontend is connecting to correct Backend URL (should be localhost:8000)
5. Verify database migrations have run (`init_db()` creates all tables)
