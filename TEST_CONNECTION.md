# Testing Backend-Frontend Connection

## Quick Test Steps

### 1. Verify Backend is Running
```bash
curl http://localhost:8000/api/health
```
Should return: `{"status":"healthy",...}`

### 2. Create Test Data
```bash
curl -X POST http://localhost:8000/api/test-data/create
```

### 3. Test API Endpoints

**Metrics:**
```bash
curl http://localhost:8000/api/metrics?hours=1
```

**Alerts:**
```bash
curl http://localhost:8000/api/alerts?limit=10
```

**Capture Status:**
```bash
curl http://localhost:8000/api/capture/status
```

### 4. Test from Browser

Open browser console and run:
```javascript
// Test connection
fetch('http://localhost:8000/api/health')
  .then(r => r.json())
  .then(console.log)

// Test metrics
fetch('http://localhost:8000/api/metrics?hours=1')
  .then(r => r.json())
  .then(console.log)

// Test alerts
fetch('http://localhost:8000/api/alerts?limit=10')
  .then(r => r.json())
  .then(console.log)
```

### 5. Check Frontend

1. Open browser DevTools (F12)
2. Go to Network tab
3. Refresh the dashboard
4. Check for API calls to `http://localhost:8000/api/`
5. Look for any CORS errors (red requests)

### 6. Common Issues

**CORS Error:**
- Backend CORS is enabled in `main.py` (lines 16-22)
- Check if frontend URL matches allowed origins

**Empty Data:**
- Run: `curl -X POST http://localhost:8000/api/test-data/create`
- Refresh dashboard

**Connection Refused:**
- Verify backend is running: `curl http://localhost:8000`
- Check port 8000 is not blocked

**404 Errors:**
- Verify endpoint paths match
- Check API base URL in frontend: `frontend/src/services/api.js`

