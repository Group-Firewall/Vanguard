"""Hybrid fusion model combining signature-based and ML-based detection"""
import numpy as np
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import logging

from ml.models.supervised import SupervisedModelTrainer
from ml.models.unsupervised import UnsupervisedModelTrainer
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SignatureEngine:
    """Signature-based detection engine (Snort-like)"""
    
    def __init__(self):
        # Define signature rules
        self.signatures = {
            'port_scan': {
                'pattern': lambda pkt: pkt.get('dst_port') in range(1, 1024) and pkt.get('packet_size', 0) < 100,
                'severity': 'high',
                'confidence': 0.8
            },
            'syn_flood': {
                'pattern': lambda pkt: pkt.get('tcp_flags') == 'S' and pkt.get('packet_size', 0) < 100,
                'severity': 'high',
                'confidence': 0.85
            },
            'large_packet': {
                'pattern': lambda pkt: pkt.get('packet_size', 0) > 1500,
                'severity': 'medium',
                'confidence': 0.6
            },
            'suspicious_port': {
                'pattern': lambda pkt: pkt.get('dst_port') in [4444, 31337, 12345, 54321],
                'severity': 'medium',
                'confidence': 0.7
            },
            'icmp_flood': {
                'pattern': lambda pkt: pkt.get('protocol') == 'ICMP' and pkt.get('packet_size', 0) < 100,
                'severity': 'medium',
                'confidence': 0.65
            }
        }
    
    def check_signatures(self, packet_features: Dict) -> Tuple[bool, float, str]:
        """
        Check packet against signature rules
        
        Returns:
            (is_malicious, confidence, signature_name)
        """
        for sig_name, sig_config in self.signatures.items():
            try:
                if sig_config['pattern'](packet_features):
                    return True, sig_config['confidence'], sig_name
            except Exception as e:
                logger.debug(f"Error checking signature {sig_name}: {e}")
        
        return False, 0.0, None


class HybridDetectionEngine:
    """Hybrid fusion detection engine"""
    
    def __init__(self):
        self.signature_engine = SignatureEngine()
        self.supervised_trainer = SupervisedModelTrainer()
        self.unsupervised_trainer = UnsupervisedModelTrainer()
        self.threshold = settings.HYBRID_FUSION_THRESHOLD
        self.signature_threshold = settings.SIGNATURE_CONFIDENCE_THRESHOLD
        self.ml_threshold = settings.ML_ANOMALY_THRESHOLD
    
    def load_models(self):
        """Load all detection models"""
        try:
            # Load supervised models
            supervised_models = ['random_forest', 'xgboost', 'lightgbm']
            for model_name in supervised_models:
                try:
                    self.supervised_trainer.load_model(model_name)
                except Exception as e:
                    logger.warning(f"Could not load {model_name}: {e}")
            
            # Load unsupervised models
            unsupervised_models = ['isolation_forest', 'one_class_svm']
            for model_name in unsupervised_models:
                try:
                    self.unsupervised_trainer.load_model(model_name)
                except Exception as e:
                    logger.warning(f"Could not load {model_name}: {e}")
        except Exception as e:
            logger.error(f"Error loading models: {e}")
    
    def detect(
        self,
        packet_features: Dict,
        feature_vector: Optional[np.ndarray] = None
    ) -> Dict:
        """
        Hybrid detection with 2-tier system
        
        Pseudocode:
        1. Check signature-based detection
        2. If signature match and confidence > threshold:
           - Return malicious with signature score
        3. If no signature match or low confidence:
           - Run supervised ML (known attacks)
           - Run unsupervised ML (zero-day)
           - Combine scores
        4. Calculate final threat score
        5. Assign severity based on score
        
        Returns:
            Detection result dictionary
        """
        result = {
            'is_malicious': False,
            'threat_score': 0.0,
            'severity': 'low',
            'detection_method': 'none',
            'signature_match': False,
            'ml_prediction': 0.0,
            'anomaly_score': 0.0,
            'hybrid_score': 0.0,
            'confidence': 0.0
        }
        
        # Tier 1: Signature-based detection
        sig_malicious, sig_confidence, sig_name = self.signature_engine.check_signatures(packet_features)
        
        if sig_malicious and sig_confidence >= self.signature_threshold:
            # High confidence signature match
            result['is_malicious'] = True
            result['signature_match'] = True
            result['threat_score'] = sig_confidence
            result['detection_method'] = 'signature'
            result['confidence'] = sig_confidence
            
            # Assign severity
            if sig_confidence >= 0.8:
                result['severity'] = 'high'
            elif sig_confidence >= 0.6:
                result['severity'] = 'medium'
            else:
                result['severity'] = 'low'
            
            return result
        
        # Tier 2: ML-based detection (if no high-confidence signature match)
        ml_scores = []
        anomaly_scores = []
        
        # Supervised ML (known attacks)
        if feature_vector is not None and self.supervised_trainer.models:
            for model_name, model in self.supervised_trainer.models.items():
                try:
                    pred, proba = self.supervised_trainer.predict(model_name, feature_vector.reshape(1, -1))
                    
                    # Get probability of attack class
                    if proba is not None:
                        # Assuming attack classes are not 'normal'
                        if len(proba[0]) > 1:
                            # Binary or multi-class
                            attack_prob = 1 - proba[0][0] if 'normal' in str(pred[0]).lower() else np.max(proba[0])
                            ml_scores.append(attack_prob)
                except Exception as e:
                    logger.debug(f"Error in supervised model {model_name}: {e}")
        
        # Unsupervised ML (zero-day)
        if feature_vector is not None and self.unsupervised_trainer.models:
            for model_name in self.unsupervised_trainer.models.keys():
                try:
                    pred, scores = self.unsupervised_trainer.predict_anomaly(model_name, feature_vector.reshape(1, -1))
                    
                    # Normalize anomaly scores (higher = more anomalous)
                    if len(scores) > 0:
                        # Convert to probability-like score
                        normalized_score = 1 / (1 + np.exp(-scores[0]))  # Sigmoid
                        anomaly_scores.append(normalized_score)
                except Exception as e:
                    logger.debug(f"Error in unsupervised model {model_name}: {e}")
        
        # Combine ML scores
        ml_prediction = np.mean(ml_scores) if ml_scores else 0.0
        anomaly_score = np.mean(anomaly_scores) if anomaly_scores else 0.0
        
        # Hybrid fusion: weighted combination
        # Weight: supervised 0.6, unsupervised 0.4
        hybrid_score = 0.6 * ml_prediction + 0.4 * anomaly_score
        
        # If signature match but low confidence, boost score
        if sig_malicious:
            hybrid_score = max(hybrid_score, sig_confidence * 0.5)
        
        # Conflict resolution
        if sig_malicious and ml_prediction < 0.3:
            # Signature says malicious but ML says benign
            # Trust signature but reduce confidence
            hybrid_score = (sig_confidence + hybrid_score) / 2
        elif not sig_malicious and ml_prediction > 0.7:
            # No signature but ML strongly suggests attack
            hybrid_score = ml_prediction
        
        # Final decision
        result['ml_prediction'] = ml_prediction
        result['anomaly_score'] = anomaly_score
        result['hybrid_score'] = hybrid_score
        result['threat_score'] = hybrid_score
        result['signature_match'] = sig_malicious
        
        if hybrid_score >= self.threshold:
            result['is_malicious'] = True
            result['detection_method'] = 'ml' if not sig_malicious else 'hybrid'
            
            # Assign severity
            if hybrid_score >= 0.8:
                result['severity'] = 'high'
            elif hybrid_score >= 0.6:
                result['severity'] = 'medium'
            else:
                result['severity'] = 'low'
        
        result['confidence'] = hybrid_score
        
        return result
    
    def batch_detect(self, packets: List[Dict], feature_vectors: Optional[np.ndarray] = None) -> List[Dict]:
        """Detect anomalies in batch of packets"""
        results = []
        
        for i, packet in enumerate(packets):
            feature_vector = feature_vectors[i] if feature_vectors is not None and i < len(feature_vectors) else None
            result = self.detect(packet, feature_vector)
            results.append(result)
        
        return results


def main():
    """Test hybrid detection"""
    engine = HybridDetectionEngine()
    engine.load_models()
    
    # Test packet
    test_packet = {
        'src_ip': '192.168.1.100',
        'dst_ip': '10.0.0.1',
        'src_port': 12345,
        'dst_port': 4444,
        'protocol': 'TCP',
        'packet_size': 64,
        'tcp_flags': 'S'
    }
    
    result = engine.detect(test_packet)
    logger.info(f"Detection result: {result}")


if __name__ == "__main__":
    main()

