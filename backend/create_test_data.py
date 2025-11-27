"""Create test data for dashboard"""
from app.database import SessionLocal, init_db
from app.models import Alert, Metric, ModelPerformance
from datetime import datetime, timedelta
import random

def create_test_data():
    """Create test data for dashboard"""
    # Initialize  database 
    init_db()
    
    db = SessionLocal()
    try:
        # Create test metrics
        print("Creating test metrics...")
        for i in range(10):
            metric = Metric(
                timestamp=datetime.now() - timedelta(minutes=i*5),
                metric_type="packet_volume",
                value=random.randint(100, 1000),
                metric_metadata={}
            )
            db.add(metric)
        
        # Create test alerts
        print("Creating test alerts...")
        severities = ['low', 'medium', 'high']
        alert_types = ['known_attack', 'zero_day', 'suspicious']
        
        for i in range(15):
            severity = random.choice(severities)
            alert = Alert(
                timestamp=datetime.now() - timedelta(minutes=i*10),
                severity=severity,
                alert_type=random.choice(alert_types),
                source_ip=f"192.168.1.{random.randint(1, 255)}",
                destination_ip=f"10.0.0.{random.randint(1, 255)}",
                protocol=random.choice(['TCP', 'UDP', 'ICMP']),
                description=f"Test alert {i+1}: {severity} severity attack detected",
                threat_score=random.uniform(0.5, 0.95),
                signature_match=random.choice([True, False]),
                ml_prediction=random.uniform(0.4, 0.9),
                hybrid_score=random.uniform(0.5, 0.95),
                resolved=random.choice([True, False]) if i > 10 else False,
                alert_metadata={
                    'test': True,
                    'detection_method': random.choice(['signature', 'ml', 'hybrid'])
                }
            )
            db.add(alert)
        
        # Create test model performance
        print("Creating test model performance...")
        models = ['random_forest', 'xgboost', 'lightgbm', 'svm']
        for model_name in models:
            perf = ModelPerformance(
                timestamp=datetime.now() - timedelta(hours=1),
                model_name=model_name,
                model_type='supervised',
                precision=random.uniform(0.85, 0.95),
                recall=random.uniform(0.80, 0.90),
                f1_score=random.uniform(0.82, 0.93),
                accuracy=random.uniform(0.88, 0.96),
                false_positive_rate=random.uniform(0.01, 0.05),
                roc_auc=random.uniform(0.90, 0.98),
                pr_auc=random.uniform(0.85, 0.95),
                latency_ms=random.uniform(2.0, 8.0),
                memory_usage_mb=random.uniform(100, 500),
                throughput_packets_per_sec=random.uniform(1000, 5000),
                performance_metadata={}
            )
            db.add(perf)
        
        db.commit()
        print("✓ Test data created successfully!")
        print(f"  - {10} metrics")
        print(f"  - {15} alerts")
        print(f"  - {len(models)} model performance records")
        
    except Exception as e:
        print(f"Error creating test data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_data()

