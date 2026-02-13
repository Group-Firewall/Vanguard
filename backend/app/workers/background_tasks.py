"""Background tasks for real-time processing"""
import asyncio
import json
from typing import Dict, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import logging

from app.services.packet_capture import PacketCaptureService
from app.services.detection_engine import DetectionEngine
from app.services.alert_manager import AlertManager
from app.services.feature_extraction import FeatureExtractionService
from app.models import Packet, Metric
from app.database import SessionLocal
from app.api.websocket import broadcast_alert, broadcast_metrics, broadcast_packet

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BackgroundProcessor:
    """Background processor for real-time packet analysis"""
    
    def __init__(self):
        self.detection_engine = DetectionEngine()
        self.alert_manager = AlertManager()
        self.feature_extractor = FeatureExtractionService()
        self.is_processing = False
        self.processed_count = 0
    
    async def process_packets(self, db: Session):
        """Process packets in real-time"""
        self.is_processing = True
        logger.info("Starting background packet processing...")
        
        try:
            while self.is_processing:
                # Get recent unprocessed packets
                packets = db.query(Packet).filter(
                    Packet.features.is_(None)  # Unprocessed packets
                ).limit(100).all()
                
                if not packets:
                    await asyncio.sleep(1)  # Wait if no packets
                    continue
                
                # Process each packet
                for packet in packets:
                    try:
                        # Extract features
                        packet_dict = {
                            'src_ip': packet.src_ip,
                            'dst_ip': packet.dst_ip,
                            'src_port': packet.src_port,
                            'dst_port': packet.dst_port,
                            'protocol': packet.protocol,
                            'packet_size': packet.packet_size,
                            'timestamp': packet.timestamp
                        }
                        
                        # Run detection
                        detection_result = self.detection_engine.detect_packet(packet_dict)
                        
                        # Update packet with features
                        feature_vector = self.feature_extractor.extract_all_features(packet_dict)
                        packet.features = feature_vector.tolist() if feature_vector is not None else None
                        
                        # Create alert if malicious
                        if detection_result.get('is_malicious', False):
                            alert = self.alert_manager.create_alert(
                                db,
                                {
                                    **detection_result,
                                    'source_ip': packet.src_ip,
                                    'destination_ip': packet.dst_ip,
                                    'protocol': packet.protocol
                                },
                                packet_id=packet.id
                            )
                            
                            if alert:
                                # Broadcast alert via WebSocket
                                await broadcast_alert({
                                    'id': alert.id,
                                    'severity': alert.severity,
                                    'description': alert.description,
                                    'timestamp': str(alert.timestamp),
                                    'threat_score': alert.threat_score
                                })
                        
                        # Broadcast EVERY packet for live monitoring
                        await broadcast_packet({
                            'id': packet.id,
                            'timestamp': str(packet.timestamp),
                            'src_ip': packet.src_ip,
                            'dst_ip': packet.dst_ip,
                            'src_port': packet.src_port,
                            'dst_port': packet.dst_port,
                            'protocol': packet.protocol,
                            'packet_size': packet.packet_size,
                            'is_intrusion': 1 if detection_result.get('is_malicious', False) else 0,
                            'scan_type': detection_result.get('attack_type', 'Normal'),
                            'raw_summary': json.loads(packet.raw_data).get('summary', '') if packet.raw_data else ''
                        })
                        
                        self.processed_count += 1
                        
                    except Exception as e:
                        logger.error(f"Error processing packet {packet.id}: {e}")
                
                # Commit changes
                db.commit()
                
                # Update metrics periodically
                if self.processed_count % 100 == 0:
                    await self._update_metrics(db)
                
                await asyncio.sleep(0.1)  # Small delay to prevent CPU overload
                
        except Exception as e:
            logger.error(f"Error in background processing: {e}")
        finally:
            self.is_processing = False
            logger.info("Background processing stopped")
    
    async def _update_metrics(self, db: Session):
        """Update system metrics"""
        try:
            # Calculate packet volume
            recent_packets = db.query(Packet).filter(
                Packet.timestamp >= datetime.now() - timedelta(minutes=1)
            ).count()
            
            # Create metric
            metric = Metric(
                timestamp=datetime.now(),
                metric_type='packet_volume',
                value=float(recent_packets),
                metric_metadata={}
            )
            db.add(metric)
            db.commit()
            
            # Broadcast metrics
            await broadcast_metrics({
                'packet_volume': recent_packets,
                'processed_count': self.processed_count,
                'timestamp': str(datetime.now())
            })
        except Exception as e:
            logger.error(f"Error updating metrics: {e}")
    
    def stop_processing(self):
        """Stop background processing"""
        self.is_processing = False
        logger.info("Stopping background processing...")


# Global processor instance
processor = BackgroundProcessor()


async def start_background_processing():
    """Start background processing task"""
    db = SessionLocal()
    try:
        await processor.process_packets(db)
    finally:
        db.close()


def stop_background_processing():
    """Stop background processing"""
    processor.stop_processing()

