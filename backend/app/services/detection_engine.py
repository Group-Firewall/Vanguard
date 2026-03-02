"""Detection Engine - Orchestrator for the hybrid detection system.

This is the central orchestrator that:
1. Receives packet data from the processing pipeline
2. Runs signature-based detection (fast, deterministic)
3. Runs ML-based detection via ml_service
4. Fuses results using the hybrid algorithm
5. Returns unified detection results

Architecture:
    PacketProcessingPipeline
        └─► DetectionEngine
                ├─► SignatureDetector (fast rule-based)
                └─► MLService (hybrid ML prediction)
                        ├─► Supervised (Random Forest)
                        └─► Unsupervised (Isolation Forest)
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import sys
from pathlib import Path

# Add backend to path for ML imports
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.ml_service import MLService, get_ml_service

logger = logging.getLogger(__name__)


# Lazy import for signature detector
_signature_detector = None

def get_signature_detector():
    """Lazy load signature detector to avoid circular imports."""
    global _signature_detector
    if _signature_detector is None:
        try:
            # Try backend.ml.models first (when running with full path)
            from backend.ml.models.signature_detection import SignatureDetector
            _signature_detector = SignatureDetector()
            logger.info("SignatureDetector initialized (backend.ml.models)")
        except ImportError:
            try:
                # Try ml.models (when running from backend directory)
                from ml.models.signature_detection import SignatureDetector
                _signature_detector = SignatureDetector()
                logger.info("SignatureDetector initialized (ml.models)")
            except ImportError as e:
                logger.warning(f"Could not load SignatureDetector: {e}")
                _signature_detector = None
    return _signature_detector


class DetectionEngine:
    """
    Detection Engine - Central orchestrator for the hybrid NIDS.
    
    Combines signature-based and ML-based detection using a fusion algorithm:
    
    Fusion Algorithm:
    1. Signature detection runs first (fast, deterministic)
    2. If signature confidence > 0.8, flag immediately as known attack
    3. If signature confidence 0.5-0.8, use ML for confirmation
    4. If signature confidence < 0.5, rely primarily on ML models
    5. Final decision based on weighted fusion of all signals
    """
    
    def __init__(self):
        self.ml_service = get_ml_service()
        self.signature_detector = get_signature_detector()
        
        # Fusion weights
        self.signature_weight = 0.3
        self.ml_weight = 0.7
        
        # Statistics
        self.stats = {
            'total_packets': 0,
            'signature_detections': 0,
            'ml_detections': 0,
            'hybrid_detections': 0,
            'conflicts': 0,
        }
        
        logger.info("DetectionEngine initialized")
    
    def detect_packet(self, packet_data: Dict) -> Dict[str, Any]:
        """
        Perform hybrid detection on a single packet.
        
        Args:
            packet_data: Dictionary containing packet features
            
        Returns:
            Dictionary with unified detection results
        """
        self.stats['total_packets'] += 1
        
        # Initialize result
        result = {
            'is_malicious': False,
            'threat_score': 0.0,
            'confidence': 0.0,
            'severity': 'low',
            'attack_type': 'Normal',
            'detection_method': 'none',
            
            # Signature detection
            'signature_match': False,
            'signature_confidence': 0.0,
            'signature_name': 'Normal',
            
            # ML detection
            'ml_prediction': 0.0,
            'ml_confidence': 0.0,
            'supervised_prediction': 0,
            'unsupervised_prediction': 0,
            'anomaly_score': 0.0,
            
            # Hybrid fusion
            'hybrid_score': 0.0,
            'decision_path': 'normal',
        }
        
        try:
            # Step 1: Signature-based detection (fast)
            sig_detected, sig_confidence, sig_name = self._run_signature_detection(packet_data)
            result['signature_match'] = sig_detected
            result['signature_confidence'] = sig_confidence
            result['signature_name'] = sig_name
            
            if sig_detected:
                self.stats['signature_detections'] += 1
            
            # Step 2: ML-based detection
            ml_result = self.ml_service.predict(packet_data)
            result['ml_prediction'] = float(ml_result.get('supervised_prediction', 0))
            result['ml_confidence'] = ml_result.get('ml_confidence', 0.0)
            result['supervised_prediction'] = ml_result.get('supervised_prediction', 0)
            result['unsupervised_prediction'] = ml_result.get('unsupervised_prediction', 0)
            result['anomaly_score'] = ml_result.get('unsupervised_confidence', 0.0)
            
            if ml_result.get('is_malicious'):
                self.stats['ml_detections'] += 1
            
            # Step 3: Fusion algorithm
            fusion_result = self._fuse_detections(
                sig_detected=sig_detected,
                sig_confidence=sig_confidence,
                sig_name=sig_name,
                ml_detected=ml_result.get('is_malicious', False),
                ml_confidence=ml_result.get('ml_confidence', 0.0),
                ml_attack_type=ml_result.get('attack_type', 'Normal'),
                ml_severity=ml_result.get('severity', 'low'),
            )
            
            # Update result with fusion output
            result.update(fusion_result)
            
            if result['is_malicious']:
                self.stats['hybrid_detections'] += 1
            
        except Exception as e:
            logger.error(f"Detection error: {e}")
        
        return result
    
    def _run_signature_detection(self, packet_data: Dict) -> tuple:
        """Run signature-based detection."""
        if self.signature_detector is None:
            return False, 0.0, 'Normal'
        
        try:
            import pandas as pd
            # Convert dict to Series for signature detector
            row = pd.Series(packet_data)
            return self.signature_detector.detect(row)
        except Exception as e:
            logger.debug(f"Signature detection skipped: {e}")
            return False, 0.0, 'Normal'
    
    def _fuse_detections(
        self,
        sig_detected: bool,
        sig_confidence: float,
        sig_name: str,
        ml_detected: bool,
        ml_confidence: float,
        ml_attack_type: str,
        ml_severity: str,
    ) -> Dict[str, Any]:
        """
        Fusion algorithm to combine signature and ML detections.
        
        Decision logic:
        - High signature confidence (>0.8): Trust signature immediately
        - Medium signature confidence (0.5-0.8): Confirm with ML
        - Low signature confidence (<0.5): Rely on ML primarily
        """
        result = {
            'is_malicious': False,
            'threat_score': 0.0,
            'confidence': 0.0,
            'severity': 'low',
            'attack_type': 'Normal',
            'detection_method': 'none',
            'hybrid_score': 0.0,
            'decision_path': 'normal',
        }
        
        # Calculate hybrid score
        hybrid_score = (
            self.signature_weight * sig_confidence +
            self.ml_weight * ml_confidence
        )
        result['hybrid_score'] = hybrid_score
        
        # Fusion decision logic
        if sig_confidence > 0.8:
            # High signature confidence - trust signature
            result['is_malicious'] = True
            result['threat_score'] = sig_confidence
            result['confidence'] = sig_confidence
            result['severity'] = self._get_severity_from_score(sig_confidence)
            result['attack_type'] = sig_name
            result['detection_method'] = 'signature'
            result['decision_path'] = 'signature_high_confidence'
            
        elif sig_confidence > 0.5:
            # Medium signature confidence - use ML for confirmation
            if ml_confidence > 0.6:
                # ML confirms signature detection
                result['is_malicious'] = True
                result['threat_score'] = hybrid_score
                result['confidence'] = hybrid_score
                result['severity'] = max(
                    self._get_severity_from_score(hybrid_score),
                    ml_severity,
                    key=self._severity_rank
                )
                result['attack_type'] = sig_name if sig_name != 'Normal' else ml_attack_type
                result['detection_method'] = 'hybrid_confirmed'
                result['decision_path'] = 'signature_ml_agreement'
            else:
                # Conflict: signature says attack, ML says normal
                self.stats['conflicts'] += 1
                result['is_malicious'] = False
                result['threat_score'] = 1 - sig_confidence
                result['confidence'] = 1 - sig_confidence
                result['decision_path'] = 'signature_ml_conflict'
                
        else:
            # Low signature confidence - rely primarily on ML
            if ml_confidence > 0.7:
                result['is_malicious'] = True
                result['threat_score'] = ml_confidence
                result['confidence'] = ml_confidence
                result['severity'] = ml_severity
                result['attack_type'] = ml_attack_type
                result['detection_method'] = 'ml_primary'
                result['decision_path'] = 'ml_high_confidence'
            else:
                result['is_malicious'] = False
                result['threat_score'] = max(sig_confidence, ml_confidence)
                result['confidence'] = 1 - ml_confidence
                result['decision_path'] = 'ml_low_confidence'
        
        return result
    
    def _get_severity_from_score(self, score: float) -> str:
        """Convert threat score to severity level."""
        if score >= 0.9:
            return 'critical'
        elif score >= 0.7:
            return 'high'
        elif score >= 0.5:
            return 'medium'
        else:
            return 'low'
    
    def _severity_rank(self, severity: str) -> int:
        """Get numeric rank for severity comparison."""
        ranks = {'low': 0, 'medium': 1, 'high': 2, 'critical': 3}
        return ranks.get(severity, 0)
    
    def detect_batch(self, packet_list: List[Dict]) -> List[Dict]:
        """
        Perform hybrid detection on a batch of packets.
        
        Args:
            packet_list: List of packet data dictionaries
            
        Returns:
            List of detection results
        """
        return [self.detect_packet(packet) for packet in packet_list]
    
    def analyze_packet(self, packet_data: Dict) -> Dict[str, Any]:
        """
        Alias for detect_packet - for backward compatibility.
        """
        return self.detect_packet(packet_data)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get detection statistics."""
        return self.stats.copy()
    
    def reset_statistics(self) -> None:
        """Reset detection statistics."""
        self.stats = {
            'total_packets': 0,
            'signature_detections': 0,
            'ml_detections': 0,
            'hybrid_detections': 0,
            'conflicts': 0,
        }
    
    def get_model_status(self) -> Dict[str, Any]:
        """Get status of underlying ML models."""
        return self.ml_service.get_model_status()


# Global instance for singleton access
_detection_engine: Optional[DetectionEngine] = None


def get_detection_engine() -> DetectionEngine:
    """Get the global detection engine instance."""
    global _detection_engine
    if _detection_engine is None:
        _detection_engine = DetectionEngine()
    return _detection_engine
