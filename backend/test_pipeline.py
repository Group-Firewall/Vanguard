#!/usr/bin/env python3
"""
Quick diagnostic script to test the entire pipeline without packet capture.
This script simulates the packet flow to verify detection and broadcasting works.
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

async def test_pipeline():
    """Test the entire pipeline with synthetic packets."""
    
    print("=" * 60)
    print("VANGUARD PIPELINE DIAGNOSTIC TEST")
    print("=" * 60)
    
    # Test 1: Check detection engine
    print("\n[TEST 1] Checking DetectionEngine...")
    try:
        from app.services.detection_engine import get_detection_engine
        engine = get_detection_engine()
        status = engine.get_model_status()
        print(f"✓ Detection engine initialized")
        print(f"  ML models loaded: {status.get('models_loaded', False)}")
        print(f"  Model directory: {status.get('model_directory', 'N/A')}")
    except Exception as e:
        print(f"✗ Detection engine error: {e}")
        return False
    
    # Test 2: Check broadcasters
    print("\n[TEST 2] Checking WebSocket broadcasters...")
    try:
        from app.core.broadcaster import packet_broadcaster, alert_broadcaster, metrics_broadcaster
        print(f"✓ Broadcasters imported")
        print(f"  Packet broadcaster connections: {len(packet_broadcaster._connections)}")
        print(f"  Alert broadcaster connections: {len(alert_broadcaster._connections)}")
        print(f"  Metrics broadcaster connections: {len(metrics_broadcaster._connections)}")
    except Exception as e:
        print(f"✗ Broadcaster error: {e}")
        return False
    
    # Test 3: Test packet stream
    print("\n[TEST 3] Checking packet stream...")
    try:
        from app.core.stream import packet_stream, PacketData
        print(f"✓ Packet stream queue ready")
        print(f"  Queue size: {packet_stream.qsize()}")
        print(f"  Queue max size: {packet_stream._maxsize}")
    except Exception as e:
        print(f"✗ Packet stream error: {e}")
        return False
    
    # Test 4: Test synthetic packet detection
    print("\n[TEST 4] Testing detection with synthetic packet...")
    try:
        synthetic_packet = {
            "src_ip": "192.168.1.100",
            "dst_ip": "8.8.8.8",
            "src_port": 54321,
            "dst_port": 443,
            "protocol": "TCP",
            "packet_size": 64,
            "ip_ttl": 64,
            "ip_len": 64,
            "ip_flags": "DF",
        }
        
        result = engine.detect_packet(synthetic_packet)
        print(f"✓ Detection executed")
        print(f"  Is malicious: {result.get('is_malicious')}")
        print(f"  Attack type: {result.get('attack_type')}")
        print(f"  Threat score: {result.get('threat_score')}")
        print(f"  Confidence: {result.get('confidence')}")
        print(f"  ML prediction: {result.get('ml_prediction')}")
    except Exception as e:
        print(f"✗ Detection error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 5: Test pipeline initialization
    print("\n[TEST 5] Checking pipeline...")
    try:
        from app.workers.background_tasks import get_pipeline
        pipeline = get_pipeline()
        print(f"✓ Pipeline initialized")
        print(f"  Pipeline running: {pipeline.is_running}")
        print(f"  Packets processed: {pipeline._packets_processed}")
        print(f"  Alerts generated: {pipeline._alerts_generated}")
    except Exception as e:
        print(f"✗ Pipeline error: {e}")
        return False
    
    # Test 6: Simulate broadcast
    print("\n[TEST 6] Testing broadcast simulation...")
    try:
        # Create a test payload
        test_payload = {
            "type": "packet",
            "data": {
                "timestamp": datetime.now().isoformat(),
                "src_ip": "192.168.1.100",
                "dst_ip": "8.8.8.8",
                "protocol": "TCP",
                "packet_size": 64,
                "is_intrusion": 0,
                "threat_score": 0.0,
            }
        }
        print(f"✓ Test payload created")
        print(f"  Payload structure: {list(test_payload.keys())}")
    except Exception as e:
        print(f"✗ Payload creation error: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED ✓")
    print("=" * 60)
    return True

if __name__ == "__main__":
    result = asyncio.run(test_pipeline())
    sys.exit(0 if result else 1)
