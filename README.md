# Vanguard – Machine Learning Based Network Intrusion Detection System (NIDS)

A production-grade Network Intrusion Detection System that combines signature-based detection with machine learning models for detecting both known and zero network intrusions.

## 🏗️ System Architecture

```
┌─────────────────┐
│  Packet Capture │
│   (Scapy/TCP)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ETL Pipeline   │
│ Feature Extract │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Signature Engine│─────▶│  Hybrid Fusion   │
│   (Snort-like)  │      │   Detection      │
└─────────────────┘      │     Engine       │
                         └────────┬─────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐    ┌─────────────────┐
│ Supervised ML   │      │ Unsupervised ML  │    │  Online Learning│
│ (Known Attacks) │      │ (Zero-Day)      │    │     (River)     │
└─────────────────┘      └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  Alert Manager  │
                         │  Threat Scoring │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │ Database  │  │   API     │  │ Dashboard │
            │ (SQLite/  │  │ (FastAPI) │  │  (React)  │
            │PostgreSQL)│  └───────────┘  └───────────┘
            └───────────┘
```

## 📁 Project Structure

```
Vanguard/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI application
│   │   ├── config.py               # Configuration settings
│   │   ├── database.py             # Database connection
│   │   ├── models.py               # SQLAlchemy models
│   │   ├── schemas.py              # Pydantic schemas
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes.py           # API endpoints
│   │   │   └── websocket.py        # WebSocket handlers
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── packet_capture.py   # Packet capture service
│   │   │   ├── feature_extraction.py
│   │   │   ├── detection_engine.py # Hybrid detection engine
│   │   │   ├── alert_manager.py    # Alert management
│   │   │   └── model_service.py    # ML model service
│   │   └── workers/
│   │       ├── __init__.py
│   │       └── background_tasks.py # Background processing
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── models/
│   │   │   ├── supervised.py       # RF, SVM, XGBoost, LightGBM
│   │   │   ├── unsupervised.py     # Isolation Forest, One-Class SVM, Autoencoders
│   │   │   ├── hybrid.py           # Hybrid fusion model
│   │   │   └── online_learning.py  # River-based online learning
│   │   ├── training/
│   │   │   ├── train_models.py
│   │   │   └── evaluate.py
│   │   ├── explainability/
│   │   │   ├── shap_analysis.py
│   │   │   └── feature_importance.py
│   │   └── preprocessing/
│   │       └── feature_engineering.py
│   └── data/
│       ├── __init__.py
│       ├── collect_data.py         # Data collection
│       ├── transform_data.py       # Feature extraction
│       ├── merge_datasets.py       # Dataset merging
│       └── store_incrementally.py  # Incremental storage
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── AlertCenter.jsx
│   │   │   ├── Metrics.jsx
│   │   │   ├── FeatureImportance.jsx
│   │   │   └── RealTimeFeed.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   └── styles/
│   │       └── index.css
├── evaluation/
│   ├── test_scenarios.py
│   ├── metrics.py
│   └── generate_reports.py
├── docs/
│   ├── architecture.md
│   └── api_documentation.md
├── requirements.txt
└── README.md
```

## 🚀 Quick Start

### Backend Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database
cd backend
python -m app.database init_db

# Train models (first time)
python -m ml.training.train_models

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Data Collection

```bash
# Collect and prepare datasets
python -m data.collect_data
python -m data.transform_data
python -m data.merge_datasets
```

## 📊 Features

- **Hybrid Detection**: Signature-based + ML-based detection
- **Zero-Day Detection**: Unsupervised models for unknown attacks
- **Real-time Monitoring**: Live packet capture and analysis
- **Online Learning**: Incremental model updates
- **Explainability**: SHAP values and feature importance
- **Comprehensive Dashboard**: Real-time alerts and metrics

## 🔧 Configuration

Create a `.env` file in the backend directory:

```env
DATABASE_URL=sqlite:///./vanguard.db
REDIS_URL=redis://localhost:6379
MODEL_PATH=./models
DATA_PATH=./data/datasets
```

## 📈 Evaluation

Run evaluation scenarios:

```bash
python -m evaluation.test_scenarios
python -m evaluation.generate_reports
```

## 📊 Evaluation

Run evaluation scenarios to test the system:

```bash
# Run test scenarios
python -m evaluation.test_scenarios

# Generate reports with plots and tables
python -m evaluation.generate_reports
```

The evaluation includes:
- **Scenario 1**: Normal + Known Attacks
- **Scenario 2**: Normal + Zero-Day Attacks  
- **Scenario 3**: Normal + Mixed Attacks

Metrics calculated:
- Precision, Recall, F1-Score
- False Positive Rate
- ROC-AUC and PR-AUC (when available)
- Latency (ms)
- Throughput (packets/sec)

Reports are generated in `data/reports/` directory.

## 🔧 Configuration

Create a `.env` file in the backend directory (see `.env.example`):

```env
DATABASE_URL=sqlite:///./vanguard.db
REDIS_URL=redis://localhost:6379/0
MODEL_PATH=./models
DATA_PATH=./data/datasets
```

## 📚 Documentation

- [Architecture Documentation](docs/architecture.md)
- [API Documentation](docs/api_documentation.md)

## 🧪 Testing

```bash
# Run unit tests
pytest backend/tests/

# Run integration tests
pytest backend/tests/integration/
```

## 🚀 Deployment

### Production Setup

1. Use PostgreSQL instead of SQLite:
   ```env
   DATABASE_URL=postgresql://user:password@localhost/vanguard
   ```

2. Set up Redis for background tasks:
   ```env
   REDIS_URL=redis://localhost:6379/0
   ```

3. Use a production ASGI server:
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
   ```

4. Set up Nginx as reverse proxy

5. Enable HTTPS with SSL certificates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License

## 🙏 Acknowledgments

- UNSW-NB15, CICIDS2017, NSL-KDD datasets
- Scapy for packet capture
- FastAPI for the backend framework
- React for the frontend framework

