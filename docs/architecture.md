# Vanguard NIDS - System Architecture

## Overview

Vanguard is a production-grade Network Intrusion Detection System (NIDS) that combines signature-based detection with machine learning models to detect both known and zero-day network intrusions in real-time.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Dashboard  │  │ Alert Center │  │   Metrics    │         │
│  │   (React)    │  │   (React)    │  │   (React)    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └─────────────────┼──────────────────┘                  │
│                           │                                     │
│                    WebSocket / REST API                         │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      API LAYER (FastAPI)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  POST /capture/start  │  POST /capture/stop              │  │
│  │  GET  /alerts         │  GET  /metrics                   │  │
│  │  GET  /feature-importance  │  POST /model/retrain        │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    SERVICE LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Packet     │  │  Detection   │  │    Alert    │         │
│  │   Capture    │  │   Engine     │  │   Manager   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│         └─────────────────┼──────────────────┘                  │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────────┐    │
│  │            Feature Extraction Service                  │    │
│  └────────────────────────┬──────────────────────────────┘    │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                   DETECTION ENGINE                                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         TIER 1: Signature-Based Detection                │  │
│  │  (Port scans, SYN floods, suspicious ports, etc.)        │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         TIER 2: ML-Based Detection                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ Supervised   │  │Unsupervised  │  │   Online     │    │  │
│  │  │   Models     │  │   Models     │  │  Learning    │    │  │
│  │  │ (RF, SVM,    │  │(Isolation    │  │   (River)    │    │  │
│  │  │ XGB, LGBM)   │  │Forest, OCSVM,│  │              │    │  │
│  │  │              │  │Autoencoder)  │  │              │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                         │
│                       ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Hybrid Fusion & Conflict Resolution                │  │
│  │  - Weighted combination of scores                         │  │
│  │  - Conflict resolution logic                             │  │
│  │  - Threat score calculation                              │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                      DATA LAYER                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  SQLite/     │  │  Event      │  │  Model       │          │
│  │ PostgreSQL   │  │  Store      │  │  Storage     │          │
│  │  (Alerts,    │  │  (Packets)  │  │  (Pickle)    │          │
│  │   Metrics)    │  │             │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Packet Capture Service
- **Technology**: Scapy
- **Function**: Captures live network traffic from specified interfaces
- **Output**: Raw packet data with extracted features
- **Storage**: SQLite/PostgreSQL database

### 2. Feature Extraction Service
- **Features Extracted**:
  - Basic: Packet size, ports, protocol, IP addresses
  - Statistical: Mean/std packet size, port entropy, packet counts
  - Flow-based: Duration, packets/sec, bytes/sec
- **Window Size**: Configurable (default: 100 packets)

### 3. Detection Engine

#### Tier 1: Signature-Based Detection
- Pattern matching for known attack signatures
- Fast, low-latency detection
- Examples may include: Port scans, SYN floods, suspicious ports

#### Tier 2: ML-Based Detection

**Supervised Models** (Known Attacks):
- Random Forest
- SVM (Support Vector Machine)
- XGBoost
- LightGBM

**Unsupervised Models** (Zero-Day):
- Isolation Forest
- One-Class SVM
- Autoencoder (PyTorch)

**Online Learning**:
- River library for incremental learning
- Partial fit with scikit-learn

#### Hybrid Fusion
- Weighted combination: 60% supervised + 40% unsupervised
- Conflict resolution when signature and ML disagree
- Final threat score calculation

### 4. Alert Manager
- Rate limiting (max alerts per minute per IP)
- Severity assignment (low, medium, high)
- Alert type classification (known_attack, zero_day, suspicious)
- Database persistence

### 5. Model Service
- Model loading and management
- Feature importance calculation (SHAP, Permutation)
- Model retraining pipeline
- Performance metrics tracking

### 6. Background Workers
- Real-time packet processing
- Asynchronous alert creation
- Metrics updates
- WebSocket broadcasting

## Data Flow

1. **Packet Capture** → Raw packets captured from network interface
2. **Feature Extraction** → Features extracted from packets
3. **Signature Check** → Fast signature-based detection
4. **ML Detection** → If no high-confidence signature match, run ML models
5. **Fusion** → Combine signature and ML scores
6. **Alert Generation** → Create alert if threat detected
7. **Storage** → Store alert in database
8. **Notification** → Broadcast via WebSocket to frontend

## Conflict Resolution Logic

When signature and ML disagree:

```
IF signature says "malicious" AND ML says "benign":
    - Trust signature but reduce confidence
    - Final score = (signature_score + ml_score) / 2
    
ELSE IF no signature AND ML strongly suggests attack:
    - Trust ML prediction
    - Final score = ml_score
    
ELSE:
    - Weighted combination: 0.6 * supervised + 0.4 * unsupervised
    - If signature match exists, boost score
```

## Performance Considerations

- **Latency**: Average < 10ms per packet
- **Throughput**: Handles 1000+ packets/second
- **Memory**: Efficient feature extraction with windowing
- **Scalability**: Background workers for parallel processing

## Security Considerations

- Rate limiting on alerts
- Input validation on all API endpoints
- Secure WebSocket connections
- Database connection pooling
- Error handling and logging

## Deployment Architecture

```
┌─────────────┐
│   Client    │
│  Browser    │
└──────┬──────┘
       │
       │ HTTPS
       │
┌──────▼──────┐
│   Nginx     │
│  (Reverse   │
│   Proxy)    │
└──────┬──────┘
       │
       ├──────────────┐
       │              │
┌──────▼──────┐  ┌───▼──────┐
│   FastAPI   │  │  Redis   │
│   Backend   │  │ (Cache)  │
└──────┬──────┘  └──────────┘
       │
┌──────▼──────┐
│ PostgreSQL  │
│  Database   │
└─────────────┘
```

## Future Enhancements

1. Distributed processing with Celery
2. Real-time streaming with Apache Kafka
3. Model versioning and A/B testing
4. Advanced threat intelligence integration
5. Automated response actions
6. Multi-tenant support

