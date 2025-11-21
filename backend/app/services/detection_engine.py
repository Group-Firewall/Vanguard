"""Hybrid detection engine service"""
import numpy as np
from typing import Dict, List, Optional
from ml.models.hybrid import HybridDetectionEngine
from app.services.feature_extraction import FeatureExtractionService
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DetectionEngine:
    """Main detection engine service"""
    
    def __init__(self):
        self.hybrid_engine = HybridDetectionEngine()
        self.feature_extractor = FeatureExtractionService(
            window_size=settings.FEATURE_WINDOW_SIZE
        )
        self._models_loaded = False
    
    def _ensure_models_loaded(self):
        """Ensure models are loaded"""
        if not self._models_loaded:
            try:
                self.hybrid_engine.load_models()
                self._models_loaded = True
                logger.info("Detection models loaded successfully")
            except Exception as e:
                logger.warning(f"Could not load all models: {e}")
    
    def detect_packet(self, packet: Dict) -> Dict:
        """Detect anomalies in a single packet"""
        self._ensure_models_loaded()
        
        # Extract features
        try:
            feature_vector = self.feature_extractor.extract_all_features(packet)
            packet_features = self.feature_extractor.extract_basic_features(packet)
        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            return {
                'is_malicious': False,
                'threat_score': 0.0,
                'severity': 'low',
                'error': str(e)
            }
        
        # Run hybrid detection
        try:
            result = self.hybrid_engine.detect(packet_features, feature_vector)
            return result
        except Exception as e:
            logger.error(f"Error in detection: {e}")
            return {
                'is_malicious': False,
                'threat_score': 0.0,
                'severity': 'low',
                'error': str(e)
            }
    
    def detect_batch(self, packets: List[Dict]) -> List[Dict]:
        """Detect anomalies in a batch of packets"""
        self._ensure_models_loaded()
        
        results = []
        feature_vectors = []
        
        for packet in packets:
            try:
                feature_vector = self.feature_extractor.extract_all_features(packet)
                packet_features = self.feature_extractor.extract_basic_features(packet)
                feature_vectors.append(feature_vector)
            except Exception as e:
                logger.error(f"Error extracting features: {e}")
                feature_vectors.append(None)
        
        # Convert to numpy array
        valid_vectors = [fv for fv in feature_vectors if fv is not None]
        if valid_vectors:
            feature_array = np.array(valid_vectors)
        else:
            feature_array = None
        
        # Run batch detection
        try:
            results = self.hybrid_engine.batch_detect(packets, feature_array)
        except Exception as e:
            logger.error(f"Error in batch detection: {e}")
            # Fallback to individual detection
            for packet in packets:
                results.append(self.detect_packet(packet))
        
        return results
    
    def reset(self):
        """Reset detection engine state"""
        self.feature_extractor.reset()

