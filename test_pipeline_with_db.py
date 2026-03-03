#!/usr/bin/env python3
"""
Fix issue: The database initialization is not happening through the full pipeline.
The issue is that in _process_batch, when an exception occurs, it silently catches it.
However, the real problem identified is that the database tables might not be initialized
when the pipeline runs outside the FastAPI app context.

This script will test with proper DB initialization.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

async def test_with_db_init():
    """Test pipeline with database initialization."""
    
    print("\n" + "=" * 60)
    print("PIPELINE TEST WITH DB INIT")
    print("=" * 60)
    
    # First, initialize the database
    print("\n[1] Initializing database...")
    from app.database import init_db
    try:
        init_db()
        print("[OK] Database initialized")
    except Exception as e:
        print(f"[FAIL] Database init failed: {e}")
    
    # Import after init_db
    from app.core.stream import packet_stream, PacketData
    from app.workers.background_tasks import get_pipeline, start_pipeline, stop_pipeline
    from datetime import datetime
    
    # Start pipeline
    print("\n[2] Starting pipeline...")
    await start_pipeline()
    await asyncio.sleep(0.5)
    
    pipeline = get_pipeline()
    print(f"[OK] Pipeline running: {pipeline.is_running}")
    
    # Add test packets
    print("\n[3] Adding test packets...")
    for i in range(5):
        packet = PacketData(
            timestamp=datetime.now(),
            src_ip=f"192.168.1.{i+1}",
            dst_ip="8.8.8.8",
            protocol="TCP",
            packet_size=64,
            src_port=12345,
            dst_port=443,
            ip_ttl=64,
            ip_len=64,
            ip_flags="DF",
            raw_summary="Test packet"
        )
        try:
            packet_stream.put_nowait(packet)
            print(f"  [OK] Packet {i+1} added")
        except Exception as e:
            print(f"  [FAIL] Packet {i+1} failed: {e}")
    
    # Wait for processing
    print("\n[4] Waiting for processing (5 seconds)...")
    for i in range(5):
        await asyncio.sleep(1)
        pipeline = get_pipeline()
        print(f"  [{i+1}s] Processed: {pipeline._packets_processed}, Alerts: {pipeline._alerts_generated}")
    
    # Stop pipeline
    print("\n[5] Stopping pipeline...")
    stop_pipeline()
    await asyncio.sleep(0.5)
    
    pipeline = get_pipeline()
    print(f"[OK] Pipeline stopped - Final stats:")
    print(f"  Packets captured: {pipeline._packets_captured}")
    print(f"  Packets processed: {pipeline._packets_processed}")
    print(f"  Alerts generated: {pipeline._alerts_generated}")

if __name__ == "__main__":
    try:
        asyncio.run(test_with_db_init())
    except Exception as e:
        print(f"\n[FAIL] Error: {e}")
        import traceback
        traceback.print_exc()
