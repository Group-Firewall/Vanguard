# Vanguard NIDS - Quick Start Guide

## Prerequisites

- Python 3.8+
- Node.js 16+ and npm
- (Optional) Redis for background tasks
- (Optional) PostgreSQL for production

## Installation

### Option 1: Automated Setup (Recommended)

**Windows:**
```bash
setup.bat
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

1. **Backend Setup:**
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database
cd backend
python -m app.database

# Generate synthetic data (if no datasets available)
python -m data.merge_datasets

# Train initial models
python -m ml.models.supervised
python -m ml.models.unsupervised
```

2. **Frontend Setup:**
```bash
cd frontend
npm install
```

## Running the System

### Start Backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

### Start Frontend

```bash
cd frontend
npm run dev
```

The dashboard will be available at: `http://localhost:5173` (or the port shown)

## First Steps

1. **Start Packet Capture:**
   - Open the dashboard
   - Click "Start Capture" button
   - Or use API: `POST http://localhost:8000/api/capture/start`

2. **View Alerts:**
   - Alerts appear in real-time in the Alert Center
   - Filter by severity (low, medium, high)
   - Resolve alerts when handled

3. **Monitor Metrics:**
   - View packet volume, attack rate, false positive rate
   - Check model confidence scores
   - Monitor throughput and latency

4. **View Feature Importance:**
   - Navigate to Feature Importance section
   - Select a model to view top features
   - Understand which features drive detection

## Testing the System

### Run Evaluation

```bash
# Run test scenarios
python -m evaluation.test_scenarios

# Generate reports
python -m evaluation.generate_reports
```

### Manual Testing

1. **Test Packet Capture:**
```bash
curl -X POST http://localhost:8000/api/capture/start \
  -H "Content-Type: application/json" \
  -d '{"interface": null, "filter": "tcp or udp"}'
```

2. **Check Status:**
```bash
curl http://localhost:8000/api/capture/status
```

3. **Get Alerts:**
```bash
curl http://localhost:8000/api/alerts?severity=high&limit=10
```

4. **Get Metrics:**
```bash
curl http://localhost:8000/api/metrics?hours=1
```

## Configuration

Edit `.env` file in the backend directory:

```env
# Database
DATABASE_URL=sqlite:///./vanguard.db

# Detection thresholds
SIGNATURE_CONFIDENCE_THRESHOLD=0.7
ML_ANOMALY_THRESHOLD=0.6
HYBRID_FUSION_THRESHOLD=0.65

# Alert settings
MAX_ALERTS_PER_MINUTE=100
```

## Troubleshooting

### Backend won't start
- Check if port 8000 is available
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Check database connection

### Frontend won't connect
- Verify backend is running on port 8000
- Check CORS settings in `backend/app/main.py`
- Check browser console for errors

### No packets captured
- Verify network interface name (use `ifconfig` or `ipconfig`)
- Check if running with appropriate permissions (may need sudo/Admin)
- Verify packet capture filter syntax

### Models not loading
- Run model training: `python -m ml.models.supervised`
- Check model files exist in `models/` directory
- Verify model paths in configuration

### Low detection accuracy
- Retrain models with more data: `POST /api/model/retrain`
- Adjust detection thresholds in `.env`
- Check feature extraction is working correctly

## Next Steps

1. **Add Real Datasets:**
   - Download UNSW-NB15, CICIDS2017, or NSL-KDD
   - Place in `data/raw/` directory
   - Run: `python -m data.collect_data`
   - Transform: `python -m data.transform_data`
   - Merge: `python -m data.merge_datasets`

2. **Customize Detection Rules:**
   - Edit `backend/ml/models/hybrid.py`
   - Add custom signatures in `SignatureEngine`
   - Adjust fusion weights

3. **Production Deployment:**
   - Set up PostgreSQL database
   - Configure Redis for background tasks
   - Use production ASGI server (Gunicorn)
   - Set up Nginx reverse proxy
   - Enable HTTPS

## Support

For issues and questions:
- Check documentation in `docs/` directory
- Review API documentation at `/docs` endpoint
- Check logs in console output

