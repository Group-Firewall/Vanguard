# Vanguard NIDS - System Architecture

## Overview

Vanguard is a production-grade Network Intrusion Detection System (NIDS) that combines signature-based detection with machine learning models to detect both known and zero-day network intrusions in real-time.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VANGUARD NIDS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────┐    │
│   │   NETWORK   │───▶│  PACKET CAPTURE │───▶│   DETECTION PIPELINE    │    │
│   │   TRAFFIC   │    │    (Scapy)      │    │  (Hybrid ML + Signature)│    │
│   └─────────────┘    └─────────────────┘    └───────────┬─────────────┘    │
│                                                         │                   │
│                                                         ▼                   │
│   ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────┐    │
│   │  REACT UI   │◀───│   WebSocket     │◀───│    ALERT MANAGER        │    │
│   │  Dashboard  │    │   Real-time     │    │    + Database           │    │
│   └─────────────┘    └─────────────────┘    └─────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Packet Capture

**File:** `backend/app/services/packet_capture.py`

```
Network Interface (Wi-Fi/Ethernet)
         │
         ▼
┌─────────────────────────────────┐
│         SCAPY SNIFFER           │
│  - Captures raw network packets │
│  - Extracts: IP, TCP/UDP, ICMP  │
│  - Runs in background thread    │
└─────────────────────────────────┘
         │
         ▼
    Packet Data:
    {
      src_ip: "192.168.1.100"
      dst_ip: "142.250.80.46"
      protocol: "TCP"
      src_port: 52341
      dst_port: 443
      packet_size: 1420
      tcp_flags: "PA"
      timestamp: "2026-03-11T10:30:00"
    }
```

**How it works:**
1. User clicks "Start Capture" → REST API call to `/capture/start`
2. Backend spawns a thread running Scapy's `sniff()` function
3. Each packet is parsed and converted to a dictionary
4. Packet data is pushed to the Detection Pipeline

---

## Layer 2: Detection Pipeline (Hybrid Architecture)

**File:** `backend/app/services/detection_engine.py`

```
                    Incoming Packet
                          │
                          ▼
         ┌────────────────────────────────┐
         │     FEATURE EXTRACTION         │
         │  - Statistical features        │
         │  - Protocol encoding           │
         │  - Payload analysis            │
         └────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  SIGNATURE  │ │ SUPERVISED  │ │UNSUPERVISED │
   │   ENGINE    │ │    MODEL    │ │    MODEL    │
   │  (Pattern   │ │  (Random    │ │ (Isolation  │
   │  Matching)  │ │   Forest)   │ │   Forest)   │
   └─────────────┘ └─────────────┘ └─────────────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
         ┌────────────────────────────────┐
         │       RESULT FUSION            │
         │  - Combine all predictions     │
         │  - Calculate threat score      │
         │  - Determine attack type       │
         └────────────────────────────────┘
                          │
                          ▼
                   Detection Result
```

### 2A: Signature Detection

**File:** `backend/ml/models/signature_detection.py`

| Pattern | Detects | Confidence |
|---------|---------|------------|
| SYN packets to port 22 | Brute Force | 50% |
| SYN packets, small size | Port Scan | 85% |
| ICMP > 1000 bytes | ICMP Flood | 80% |
| TCP SYN, < 100 bytes | SYN Flood | 85% |
| Traffic to ports 3306/5432 | Database Attack | 60% |

**Pros:** Fast, deterministic, no false positives on known attacks  
**Cons:** Cannot detect novel (zero-day) attacks

---

### 2B: Supervised Model (Random Forest)

**File:** `backend/ml/models/supervised.py`

```
Training Data (labeled)        New Packet
        │                           │
        ▼                           ▼
┌───────────────────┐    ┌───────────────────┐
│   Random Forest   │    │    Prediction     │
│   100 trees       │───▶│  0 = Normal       │
│   max_depth=20    │    │  1 = Attack       │
└───────────────────┘    └───────────────────┘
```

**What it learned from:** CICIDS2017, NSL-KDD, UNSW-NB15 datasets  
**Features used:** Packet size, port numbers, protocol, flags, timing  
**Output:** Binary classification (normal vs attack) + probability

---

### 2C: Unsupervised Model (Isolation Forest)

**File:** `backend/ml/models/unsupervised.py`

```
Normal Traffic Patterns          New Packet
        │                            │
        ▼                            ▼
┌───────────────────┐    ┌────────────────────┐
│  Isolation Forest │    │  Anomaly Score     │
│  Learns "normal"  │───▶│  -1 = Anomaly      │
│  behavior         │    │   1 = Normal       │
└───────────────────┘    └────────────────────┘
```

**Purpose:** Detect UNKNOWN attacks not in training data  
**How it works:** Isolates outliers that don't fit normal patterns  
**Key strength:** Zero-day attack detection

---

### 2D: Result Fusion (Hybrid Logic)

**File:** `backend/app/services/ml_service.py`

```python
# Decision Matrix
if signature_match:
    threat_score = signature_confidence * 0.4 + ml_confidence * 0.6
elif supervised_attack AND unsupervised_anomaly:
    threat_score = 0.95  # High confidence
    attack_type = "Zero-Day/Novel Attack"
elif supervised_attack:
    threat_score = supervised_probability
elif unsupervised_anomaly:
    threat_score = 0.70  # Moderate confidence
else:
    threat_score = 0.0  # Normal traffic
```

**Attack Type Classification:**

| Condition | Classification |
|-----------|----------------|
| Port 22, 23, 3389 | Brute Force Attempt |
| Small TCP packets | Port Scan |
| ICMP > 1000 bytes | ICMP Flood |
| Port 3306, 5432, 1433 | Database Attack |
| Anomaly only | Zero-Day/Novel Attack |

---

## Layer 3: Alert Management

**File:** `backend/app/services/alert_manager.py`

```
Detection Result (is_attack=True)
              │
              ▼
┌─────────────────────────────────┐
│        ALERT MANAGER            │
│  - Rate limiting (anti-spam)    │
│  - Severity assignment          │
│  - Database storage             │
│  - WebSocket broadcast          │
└─────────────────────────────────┘
              │
              ├──────────────────────┐
              ▼                      ▼
┌─────────────────────┐   ┌─────────────────────┐
│   SQLite Database   │   │   WebSocket Pub     │
│   (vanguard.db)     │   │   /ws/alerts        │
└─────────────────────┘   └─────────────────────┘
```

**Alert Structure:**
```json
{
  "id": 1,
  "timestamp": "2026-03-11T10:30:45",
  "source_ip": "192.168.1.100",
  "destination_ip": "127.0.0.1",
  "attack_type": "Brute Force Attempt",
  "severity": "high",
  "threat_score": 0.85,
  "protocol": "TCP",
  "port": 22,
  "status": "new"
}
```

---

## Layer 4: Real-Time Communication

**File:** `backend/app/api/websocket.py`

```
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket Channels                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   /ws/packets  ──────▶  Live packet stream                  │
│                         (Raw capture data)                   │
│                                                              │
│   /ws/alerts   ──────▶  Real-time alerts                    │
│                         (Detection events)                   │
│                                                              │
│   /ws/metrics  ──────▶  System metrics                      │
│                         (Packets/sec, CPU, memory)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**
1. Backend captures packet → broadcasts to `/ws/packets`
2. Detection finds attack → broadcasts to `/ws/alerts`
3. Every second → broadcasts stats to `/ws/metrics`
4. Frontend subscribes → UI updates instantly

---

## Layer 5: React Frontend

```
┌─────────────────────────────────────────────────────────────┐
│                      REACT DASHBOARD                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Dashboard   │  │   Traffic    │  │    Alert     │       │
│  │  (Overview)  │  │  Monitoring  │  │    Center    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Detection   │  │   Reports    │  │   Settings   │       │
│  │   Engines    │  │  (Security)  │  │   (Admin)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Pages:**

| Page | Purpose |
|------|---------|
| Dashboard | System overview, attack statistics, live charts |
| Traffic Monitoring | Live packet stream, start/stop capture |
| Alert Center | All detection alerts, filtering, actions |
| Detection Engines | ML model status, accuracy metrics |
| Reports | Generate security reports, capture sessions |
| Settings | User management, system configuration |

---

## Complete Data Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Network │───▶│ Scapy   │───▶│ Feature │───▶│ Hybrid  │───▶│ Alert   │
│ Traffic │    │ Capture │    │ Extract │    │ ML/Sig  │    │ Manager │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                                                  │
                    ┌─────────────────────────────────────────────┘
                    │
                    ▼
              ┌─────────┐    ┌─────────┐    ┌─────────┐
              │WebSocket│───▶│ React   │───▶│  User   │
              │ Publish │    │   UI    │    │  Sees   │
              └─────────┘    └─────────┘    └─────────┘
```

**Timing:**
1. Packet captured: **< 1ms**
2. Feature extraction: **~5ms**
3. ML prediction: **~10ms**
4. Alert generation: **~2ms**
5. WebSocket delivery: **~5ms**
6. **Total latency: ~25ms** (near real-time)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Packet Capture | **Scapy** (Python) |
| ML Models | **Scikit-learn** (Random Forest, Isolation Forest) |
| Backend API | **FastAPI** (Python) |
| Real-time | **WebSockets** |
| Database | **SQLite** |
| Frontend | **React + Vite** |
| Styling | **Tailwind CSS** |
| Charts | **Recharts** |
| Auth | **JWT Tokens** |

---

## Why Hybrid Detection?

| Method | Strength | Weakness |
|--------|----------|----------|
| Signature | Fast, accurate for known attacks | Misses new attacks |
| Supervised ML | Generalizes from training data | Needs labeled data |
| Unsupervised ML | Detects unknown anomalies | Higher false positives |
| **Hybrid** | **Best of all three** | Slightly more complex |

The hybrid approach combines all three to maximize detection while minimizing false alarms.

---

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

---

## Performance Considerations

- **Latency**: Average < 25ms per packet end-to-end
- **Throughput**: Handles 1000+ packets/second
- **Memory**: Efficient feature extraction with windowing
- **Scalability**: Background workers for parallel processing

---

## Security Features

- **Authentication**: JWT token-based authentication
- **Role-Based Access Control**: Admin, Analyst, Viewer roles
- **Rate Limiting**: Prevents alert spam and API abuse
- **Input Validation**: All API endpoints validated
- **Secure WebSocket**: Authenticated real-time connections

---

## File Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry
│   ├── config.py            # Configuration settings
│   ├── database.py          # SQLite database setup
│   ├── models.py            # SQLAlchemy ORM models
│   ├── security.py          # JWT auth, RBAC
│   ├── api/
│   │   ├── routes.py        # REST API endpoints
│   │   ├── websocket.py     # WebSocket handlers
│   │   ├── auth.py          # Authentication routes
│   │   └── ml_routes.py     # ML model endpoints
│   └── services/
│       ├── packet_capture.py    # Scapy capture service
│       ├── detection_engine.py  # Main detection pipeline
│       ├── ml_service.py        # ML model management
│       ├── alert_manager.py     # Alert generation
│       └── feature_extraction.py # Feature engineering
├── ml/
│   ├── models/
│   │   ├── supervised.py        # Random Forest model
│   │   ├── unsupervised.py      # Isolation Forest model
│   │   ├── signature_detection.py # Pattern matching
│   │   └── preprocessing.py     # Feature preprocessing
│   └── trained_models/          # Saved model files (.pkl)
└── demo_attacks.py              # Attack simulation script

frontend/
├── src/
│   ├── App.jsx              # Main React application
│   ├── pages/
│   │   ├── Dashboard.jsx        # Overview dashboard
│   │   ├── TrafficMonitoring.jsx # Live packet viewer
│   │   ├── AlertCenter.jsx      # Alert management
│   │   ├── DetectionEngines.jsx # ML model status
│   │   ├── Reports.jsx          # Security reports
│   │   └── Settings.jsx         # System settings
│   ├── components/              # Reusable UI components
│   ├── contexts/
│   │   ├── AuthContext.jsx      # Authentication state
│   │   └── CaptureContext.jsx   # Global capture state
│   ├── hooks/
│   │   └── useWebSocket.js      # WebSocket hook
│   └── services/
│       └── api.js               # API client
```

---

## Deployment Architecture (Production)

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

---

## Future Enhancements

1. Distributed processing with Celery
2. Real-time streaming with Apache Kafka
3. Model versioning and A/B testing
4. Advanced threat intelligence integration
5. Automated response actions (block IP, quarantine)
6. Multi-tenant support
7. SIEM integration (Splunk, ELK Stack)
8. Network flow analysis (NetFlow/sFlow)

