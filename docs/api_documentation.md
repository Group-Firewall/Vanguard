# Vanguard NIDS - API Documentation

## Base URL
```
http://localhost:8000/api
```

## Authentication
Currently, the API does not require authentication. In production, implement JWT or OAuth2.

## Endpoints

### Packet Capture

#### Start Capture
```http
POST /capture/start
```

**Request Body:**
```json
{
  "interface": "eth0",  // Optional, auto-detect if null
  "filter": "tcp or udp"  // Optional, default: "tcp or udp"
}
```

**Response:**
```json
{
  "is_capturing": true,
  "packets_captured": 0,
  "start_time": "2024-01-01T12:00:00",
  "interface": "eth0"
}
```

#### Stop Capture
```http
POST /capture/stop
```

**Response:**
```json
{
  "is_capturing": false,
  "packets_captured": 1234,
  "start_time": null,
  "interface": null
}
```

#### Get Capture Status
```http
GET /capture/status
```

**Response:**
```json
{
  "is_capturing": true,
  "packets_captured": 1234,
  "start_time": "2024-01-01T12:00:00",
  "interface": "eth0"
}
```

### Alerts

#### Get Alerts
```http
GET /alerts?severity=high&resolved=false&limit=100&offset=0
```

**Query Parameters:**
- `severity` (optional): Filter by severity (low, medium, high)
- `resolved` (optional): Filter by resolved status (true/false)
- `limit` (optional): Maximum number of alerts (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
[
  {
    "id": 1,
    "timestamp": "2024-01-01T12:00:00",
    "severity": "high",
    "alert_type": "known_attack",
    "source_ip": "192.168.1.100",
    "destination_ip": "10.0.0.1",
    "protocol": "TCP",
    "description": "Signature-based detection: port_scan",
    "threat_score": 0.85,
    "signature_match": true,
    "ml_prediction": 0.0,
    "hybrid_score": 0.85,
    "resolved": false,
    "metadata": {}
  }
]
```

#### Get Alert by ID
```http
GET /alerts/{alert_id}
```

**Response:**
```json
{
  "id": 1,
  "timestamp": "2024-01-01T12:00:00",
  "severity": "high",
  ...
}
```

#### Resolve Alert
```http
PATCH /alerts/{alert_id}/resolve
```

**Response:**
```json
{
  "message": "Alert resolved"
}
```

#### Create Alert
```http
POST /alert
```

**Request Body:**
```json
{
  "severity": "high",
  "alert_type": "known_attack",
  "source_ip": "192.168.1.100",
  "destination_ip": "10.0.0.1",
  "protocol": "TCP",
  "description": "Attack detected",
  "threat_score": 0.85,
  "signature_match": true,
  "ml_prediction": 0.0,
  "hybrid_score": 0.85
}
```

### Metrics

#### Get Metrics
```http
GET /metrics?hours=1
```

**Query Parameters:**
- `hours` (optional): Time window in hours (default: 1)

**Response:**
```json
{
  "timestamp": "2024-01-01T12:00:00",
  "packet_volume": 10000,
  "attack_rate": 2.5,
  "false_positive_rate": 0.1,
  "model_confidence": {
    "random_forest": 0.95,
    "xgboost": 0.93
  },
  "throughput": 100.5,
  "latency_ms": 5.2
}
```

### Feature Importance

#### Get Feature Importance
```http
GET /feature-importance?model_name=random_forest
```

**Query Parameters:**
- `model_name` (optional): Specific model name, or null for all models

**Response:**
```json
{
  "model_name": "random_forest",
  "features": {
    "packet_size": {
      "importance_mean": 0.15,
      "importance_std": 0.02
    },
    "dst_port": {
      "importance_mean": 0.12,
      "importance_std": 0.01
    }
  },
  "shap_values": null
}
```

### Model Management

#### Retrain Models
```http
POST /model/retrain
```

**Request Body:**
```json
{
  "model_type": "all",  // Options: "supervised", "unsupervised", "hybrid", "all"
  "force": false  // Force retraining even if recently trained
}
```

**Response:**
```json
{
  "message": "Retraining all models started"
}
```

### Health Check

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00",
  "capture_active": true
}
```

## WebSocket Endpoints

### Alerts Stream
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/alerts');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'alert') {
    console.log('New alert:', data.data);
  }
};
```

**Message Format:**
```json
{
  "type": "alert",
  "data": {
    "id": 1,
    "severity": "high",
    "description": "Attack detected",
    "timestamp": "2024-01-01T12:00:00",
    "threat_score": 0.85
  }
}
```

### Metrics Stream
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/metrics');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'metrics') {
    console.log('Metrics update:', data.data);
  }
};
```

**Message Format:**
```json
{
  "type": "metrics",
  "data": {
    "packet_volume": 1000,
    "processed_count": 5000,
    "timestamp": "2024-01-01T12:00:00"
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message here"
}
```

**Status Codes:**
- `200`: Success
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting


## Examples

### Python Example
```python
import requests

# Start capture
response = requests.post('http://localhost:8000/api/capture/start', json={
    'interface': 'eth0',
    'filter': 'tcp or udp'
})
print(response.json())

# Get alerts
response = requests.get('http://localhost:8000/api/alerts', params={
    'severity': 'high',
    'limit': 10
})
alerts = response.json()
print(alerts)
```

### JavaScript Example
```javascript
// Start capture
const response = await fetch('http://localhost:8000/api/capture/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ interface: 'eth0' })
});
const status = await response.json();
console.log(status);

// Get alerts
const alertsResponse = await fetch('http://localhost:8000/api/alerts?severity=high');
const alerts = await alertsResponse.json();
console.log(alerts);
```

