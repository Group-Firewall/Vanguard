# ✅ Vanguard NIDS - Setup Complete!

## What's Been Configured

### ✅ 1. Main Application (`backend/app/main.py`)
- **Location**: `backend/app/main.py` (lines 1-57)
- **CORS**: ✅ Already enabled (lines 16-22)
  - Allows all origins: `allow_origins=["*"]`
  - Allows all methods and headers
  - Ready for frontend communication

### ✅ 2. New API Endpoints Added

All endpoints are available at: `http://localhost:8000/api/`

#### `/api/predict` (POST)
- **Purpose**: Predict if network traffic is malicious
- **Request Body**:
  ```json
  {
    "src_ip": "192.168.1.100",
    "dst_ip": "10.0.0.1",
    "src_port": 12345,
    "dst_port": 80,
    "protocol": "TCP",
    "packet_size": 1500,
    "tcp_flags": "S"
  }
  ```
- **Response**: Prediction with threat score, severity, detection method

#### `/api/predict/batch` (POST)
- **Purpose**: Predict for multiple packets at once
- **Request Body**: Array of packets

#### `/api/train` (POST)
- **Purpose**: Train or retrain ML models
- **Request Body**:
  ```json
  {
    "model_type": "all",  // or "supervised", "unsupervised", "hybrid"
    "force": false
  }
  ```

#### `/api/logs` (GET)
- **Purpose**: Get traffic logs and alerts
- **Query Parameters**: `limit`, `severity`, `start_date`, `end_date`
- **Response**: List of alerts/logs

#### `/api/health` (GET)
- **Purpose**: System health check
- **Response**: Status, database status, model status, statistics

### ✅ 3. Hybrid Model Loading

- **Model Location**: `backend/models/hybrid/hybrid.pkl`
- **Service**: `backend/app/services/ml_service.py`
- **Auto-loads** on startup
- **Falls back** to initializing new engine if model file doesn't exist

### ✅ 4. MySQL Database Support

- **Configuration**: `backend/app/config.py`
- **Database Module**: `backend/app/database.py` (updated)
- **Setup Guide**: `MYSQL_SETUP.md`

## Quick Start

### Step 1: Save Hybrid Model (First Time)

```bash
cd backend
python save_hybrid_model.py
```

This creates `backend/models/hybrid/hybrid.pkl`

### Step 2: Configure MySQL (Optional)

1. Install MySQL (see `MYSQL_SETUP.md`)
2. Create database:
   ```sql
   CREATE DATABASE vanguard;
   ```
3. Update `.env` in `backend/`:
   ```env
   DATABASE_URL=mysql+pymysql://username:password@localhost:3306/vanguard
   ```
4. Initialize:
   ```bash
   cd backend
   python -m app.database
   ```

### Step 3: Start Backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

### Step 4: Test Endpoints

Visit: `http://localhost:8000/docs`

Test `/api/predict`:
```bash
curl -X POST "http://localhost:8000/api/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "src_ip": "192.168.1.100",
    "dst_ip": "10.0.0.1",
    "src_port": 12345,
    "dst_port": 4444,
    "protocol": "TCP",
    "packet_size": 64
  }'
```

## Frontend Integration

### Using Axios (Example)

```javascript
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

// Predict
const predict = async (packetData) => {
  const response = await axios.post(`${API_URL}/predict`, packetData);
  return response.data;
};

// Get logs
const getLogs = async (limit = 100) => {
  const response = await axios.get(`${API_URL}/logs`, { params: { limit } });
  return response.data;
};

// Health check
const checkHealth = async () => {
  const response = await axios.get(`${API_URL}/health`);
  return response.data;
};
```

### Using Fetch (Example)

```javascript
// Predict
const predict = async (packetData) => {
  const response = await fetch('http://localhost:8000/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packetData)
  });
  return response.json();
};
```

## Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/predict` | POST | Single prediction |
| `/api/predict/batch` | POST | Batch predictions |
| `/api/train` | POST | Train models |
| `/api/logs` | GET | Get alerts/logs |
| `/api/health` | GET | System health |
| `/api/alerts` | GET | Get alerts |
| `/api/metrics` | GET | Get metrics |
| `/api/capture/start` | POST | Start capture |
| `/api/capture/stop` | POST | Stop capture |

## Verification Checklist

- [x] CORS enabled in `main.py`
- [x] `/api/predict` endpoint created
- [x] `/api/train` endpoint created
- [x] `/api/logs` endpoint created
- [x] `/api/health` endpoint created
- [x] Hybrid model loading service created
- [x] MySQL support added
- [x] Schemas updated
- [x] Routes registered in `main.py`

## Next Steps

1. **Save the hybrid model**: Run `python save_hybrid_model.py`
2. **Test endpoints**: Visit `http://localhost:8000/docs`
3. **Connect frontend**: Update frontend API calls to use new endpoints
4. **Configure MySQL**: Follow `MYSQL_SETUP.md` if using MySQL

## Troubleshooting

### Model Not Loading
- Run: `python save_hybrid_model.py`
- Check: `backend/models/hybrid/hybrid.pkl` exists

### CORS Errors
- Already enabled in `main.py` lines 16-22
- Verify frontend URL matches allowed origins

### Database Connection
- Check `.env` file for `DATABASE_URL`
- Verify MySQL is running
- Testong connection: `python -c "from app.database import engine; print('Connected!')"`

