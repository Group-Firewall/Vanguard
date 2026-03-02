"""ML Service - Gateway for all ML operations.

This service follows clean architecture principles:
- Single responsibility: handles all ML model loading and inference
- Abstraction: hides ML implementation details from other services
- Interface: provides simple predict() method for detection_engine
"""

import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import numpy as np
import pandas as pd
import joblib

logger = logging.getLogger(__name__)

# Get the base directory of the backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
MODEL_DIR = BASE_DIR / "ml" / "trained_models"


class MLService:
    """
    ML Service - Central gateway for machine learning operations.
    
    Responsibilities:
    - Load and manage trained models
    - Preprocess incoming data
    - Run inference using hybrid detection
    - Return prediction results
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        # Singleton pattern to avoid loading models multiple times
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if MLService._initialized:
            return
            
        self.model_dir = MODEL_DIR
        self.preprocessor = None
        self.supervised_model = None
        self.unsupervised_model = None
        self.unsupervised_threshold = 0.0
        self.hybrid_config = None
        self.models_loaded = False
        
        # Weights for hybrid fusion
        self.signature_weight = 0.3
        self.supervised_weight = 0.5
        self.unsupervised_weight = 0.2
        
        # Try to load models on initialization
        try:
            self.load_models()
        except Exception as e:
            logger.warning(f"Models not loaded during init: {e}")
            
        MLService._initialized = True
    
    def load_models(self) -> bool:
        """
        Load all trained models from disk.
        
        Returns:
            bool: True if models loaded successfully
        """
        try:
            logger.info(f"Loading models from: {self.model_dir}")
            
            # Load preprocessor
            preprocessor_path = self.model_dir / "preprocessor.pkl"
            if preprocessor_path.exists():
                preprocessor_data = joblib.load(preprocessor_path)
                self.preprocessor = preprocessor_data
                logger.info("Preprocessor loaded successfully")
            else:
                logger.warning(f"Preprocessor not found at {preprocessor_path}")
            
            # Load supervised model (Random Forest)
            supervised_path = self.model_dir / "supervised_random_forest.pkl"
            if supervised_path.exists():
                self.supervised_model = joblib.load(supervised_path)
                logger.info("Supervised model (Random Forest) loaded successfully")
            else:
                logger.warning(f"Supervised model not found at {supervised_path}")
            
            # Load unsupervised model (Isolation Forest)
            unsupervised_path = self.model_dir / "unsupervised_isolation_forest.pkl"
            if unsupervised_path.exists():
                unsup_data = joblib.load(unsupervised_path)
                # Handle both dict format and direct model format
                if isinstance(unsup_data, dict):
                    self.unsupervised_model = unsup_data.get('model')
                    self.unsupervised_threshold = unsup_data.get('threshold', 0.0)
                else:
                    self.unsupervised_model = unsup_data
                    self.unsupervised_threshold = 0.0
                logger.info("Unsupervised model (Isolation Forest) loaded successfully")
            else:
                logger.warning(f"Unsupervised model not found at {unsupervised_path}")
            
            # Load hybrid detector config
            hybrid_path = self.model_dir / "hybrid_detector.pkl"
            if hybrid_path.exists():
                self.hybrid_config = joblib.load(hybrid_path)
                # Load weights from hybrid config if available
                if isinstance(self.hybrid_config, dict):
                    self.signature_weight = self.hybrid_config.get('signature_weight', 0.3)
                    self.supervised_weight = self.hybrid_config.get('supervised_weight', 0.5)
                    self.unsupervised_weight = self.hybrid_config.get('unsupervised_weight', 0.2)
                logger.info("Hybrid detector config loaded successfully")
            else:
                logger.warning(f"Hybrid config not found at {hybrid_path}")
            
            self.models_loaded = self.supervised_model is not None
            return self.models_loaded
            
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            self.models_loaded = False
            return False
    
    def preprocess_packet(self, packet_data: Dict) -> Optional[np.ndarray]:
        """
        Preprocess a single packet for ML inference.
        
        Args:
            packet_data: Dictionary containing packet features
            
        Returns:
            Preprocessed feature vector or None if preprocessing fails
        """
        try:
            # Create DataFrame from packet data
            df = pd.DataFrame([packet_data])
            
            # If preprocessor is loaded, use it
            if self.preprocessor and isinstance(self.preprocessor, dict):
                scaler = self.preprocessor.get('scaler')
                selected_features = self.preprocessor.get('selected_features', [])
                
                # Extract basic numeric features
                feature_vector = self._extract_features(packet_data)
                
                if scaler and len(feature_vector) > 0:
                    # Ensure feature vector matches expected dimensions
                    feature_array = np.array(feature_vector).reshape(1, -1)
                    if feature_array.shape[1] == scaler.n_features_in_:
                        return scaler.transform(feature_array)[0]
                    else:
                        # Pad or truncate to match expected features
                        padded = np.zeros((1, scaler.n_features_in_))
                        n = min(feature_array.shape[1], scaler.n_features_in_)
                        padded[0, :n] = feature_array[0, :n]
                        return scaler.transform(padded)[0]
                        
                return np.array(feature_vector)
            else:
                # Fallback: extract basic features without preprocessing
                return np.array(self._extract_features(packet_data))
                
        except Exception as e:
            logger.error(f"Error preprocessing packet: {e}")
            return None
    
    def _extract_features(self, packet_data: Dict) -> List[float]:
        """Extract numeric features from packet data."""
        features = []
        
        # Basic features
        features.append(float(packet_data.get('packet_size', 0)))
        features.append(float(packet_data.get('src_port', 0) or 0))
        features.append(float(packet_data.get('dst_port', 0) or 0))
        features.append(float(packet_data.get('ip_ttl', 64) or 64))
        features.append(float(packet_data.get('ip_len', 0) or 0))
        
        # Protocol encoding
        protocol = packet_data.get('protocol', 'unknown').upper()
        protocol_map = {'TCP': 1, 'UDP': 2, 'ICMP': 3, 'UNKNOWN': 0}
        features.append(float(protocol_map.get(protocol, 0)))
        
        # Time-based features (if timestamp present)
        timestamp = packet_data.get('timestamp')
        if timestamp:
            from datetime import datetime
            if isinstance(timestamp, str):
                try:
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except:
                    timestamp = datetime.now()
            elif not isinstance(timestamp, datetime):
                timestamp = datetime.now()
            features.append(float(timestamp.hour))
            features.append(float(timestamp.minute))
            features.append(float(1 if timestamp.weekday() >= 5 else 0))  # weekend
        else:
            features.extend([0.0, 0.0, 0.0])
        
        return features
    
    def predict_supervised(self, features: np.ndarray) -> Tuple[int, float]:
        """
        Run supervised model prediction.
        
        Returns:
            Tuple of (prediction, confidence)
        """
        if self.supervised_model is None:
            return 0, 0.0
            
        try:
            features_2d = features.reshape(1, -1) if features.ndim == 1 else features
            
            # Handle feature dimension mismatch
            expected_features = getattr(self.supervised_model, 'n_features_in_', None)
            if expected_features and features_2d.shape[1] != expected_features:
                padded = np.zeros((1, expected_features))
                n = min(features_2d.shape[1], expected_features)
                padded[0, :n] = features_2d[0, :n]
                features_2d = padded
            
            prediction = int(self.supervised_model.predict(features_2d)[0])
            
            # Get probability/confidence
            if hasattr(self.supervised_model, 'predict_proba'):
                proba = self.supervised_model.predict_proba(features_2d)[0]
                confidence = float(proba[1] if len(proba) > 1 else proba[0])
            else:
                confidence = 1.0 if prediction == 1 else 0.0
                
            return prediction, confidence
            
        except Exception as e:
            logger.error(f"Supervised prediction error: {e}")
            return 0, 0.0
    
    def predict_unsupervised(self, features: np.ndarray) -> Tuple[int, float]:
        """
        Run unsupervised anomaly detection.
        
        Returns:
            Tuple of (is_anomaly, anomaly_score)
        """
        if self.unsupervised_model is None:
            return 0, 0.0
            
        try:
            features_2d = features.reshape(1, -1) if features.ndim == 1 else features
            
            # Handle feature dimension mismatch
            expected_features = getattr(self.unsupervised_model, 'n_features_in_', None)
            if expected_features and features_2d.shape[1] != expected_features:
                padded = np.zeros((1, expected_features))
                n = min(features_2d.shape[1], expected_features)
                padded[0, :n] = features_2d[0, :n]
                features_2d = padded
            
            # Isolation Forest returns -1 for anomalies, 1 for normal
            prediction = self.unsupervised_model.predict(features_2d)[0]
            is_anomaly = 1 if prediction == -1 else 0
            
            # Get anomaly score using decision function
            if hasattr(self.unsupervised_model, 'decision_function'):
                score = -self.unsupervised_model.decision_function(features_2d)[0]
                # Normalize score to 0-1 range
                anomaly_score = float(max(0.0, min(1.0, (score + 0.5) / 1.0)))
            else:
                anomaly_score = 0.7 if is_anomaly else 0.3
                
            return is_anomaly, anomaly_score
            
        except Exception as e:
            logger.error(f"Unsupervised prediction error: {e}")
            return 0, 0.0
    
    def predict(self, packet_data: Dict) -> Dict[str, Any]:
        """
        Run hybrid detection on a single packet.
        
        This is the main entry point for detection_engine.
        
        Args:
            packet_data: Dictionary containing packet features
            
        Returns:
            Dictionary with detection results
        """
        result = {
            'is_malicious': False,
            'threat_score': 0.0,
            'confidence': 0.0,
            'attack_type': 'Normal',
            'severity': 'low',
            'detection_method': 'none',
            'supervised_prediction': 0,
            'supervised_confidence': 0.0,
            'unsupervised_prediction': 0,
            'unsupervised_confidence': 0.0,
            'ml_confidence': 0.0,
        }
        
        try:
            # Preprocess packet
            features = self.preprocess_packet(packet_data)
            
            if features is None:
                return result
            
            # Run supervised prediction
            sup_pred, sup_conf = self.predict_supervised(features)
            result['supervised_prediction'] = sup_pred
            result['supervised_confidence'] = sup_conf
            
            # Run unsupervised prediction
            unsup_pred, unsup_conf = self.predict_unsupervised(features)
            result['unsupervised_prediction'] = unsup_pred
            result['unsupervised_confidence'] = unsup_conf
            
            # Fusion: Combine predictions
            ml_confidence = (
                self.supervised_weight * sup_conf +
                self.unsupervised_weight * unsup_conf
            )
            result['ml_confidence'] = ml_confidence
            
            # Fusion decision: weighted voting
            weighted_vote = (
                self.supervised_weight * sup_pred +
                self.unsupervised_weight * unsup_pred
            )
            
            # Threshold for detection
            is_attack = weighted_vote > 0.5 or ml_confidence > 0.7
            
            result['is_malicious'] = is_attack
            result['threat_score'] = ml_confidence
            result['confidence'] = ml_confidence
            
            if is_attack:
                result['detection_method'] = 'ml_hybrid'
                result['severity'] = self._calculate_severity(ml_confidence)
                result['attack_type'] = self._determine_attack_type(sup_pred, unsup_pred, packet_data)
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            
        return result
    
    def predict_batch(self, packet_list: List[Dict]) -> List[Dict]:
        """
        Run hybrid detection on a batch of packets.
        
        Args:
            packet_list: List of packet data dictionaries
            
        Returns:
            List of detection results
        """
        return [self.predict(packet) for packet in packet_list]
    
    def _calculate_severity(self, threat_score: float) -> str:
        """Calculate severity based on threat score."""
        if threat_score >= 0.9:
            return 'critical'
        elif threat_score >= 0.7:
            return 'high'
        elif threat_score >= 0.5:
            return 'medium'
        else:
            return 'low'
    
    def _determine_attack_type(self, sup_pred: int, unsup_pred: int, packet_data: Dict) -> str:
        """Determine attack type based on predictions and packet characteristics."""
        protocol = packet_data.get('protocol', '').upper()
        dst_port = packet_data.get('dst_port', 0) or 0
        packet_size = packet_data.get('packet_size', 0)
        
        # Heuristics for attack type classification
        if unsup_pred == 1 and sup_pred == 0:
            return 'Zero-Day/Novel Attack'
        elif protocol == 'ICMP' and packet_size > 1000:
            return 'ICMP Flood'
        elif protocol == 'TCP' and packet_size < 100:
            return 'Port Scan'
        elif dst_port in [22, 23, 3389]:
            return 'Brute Force Attempt'
        elif dst_port in [3306, 5432, 1433]:
            return 'Database Attack'
        elif protocol == 'UDP' and packet_size > 1400:
            return 'UDP Flood'
        else:
            return 'Malicious Traffic'
    
    def get_model_status(self) -> Dict[str, Any]:
        """Get status of loaded models."""
        return {
            'models_loaded': self.models_loaded,
            'preprocessor_loaded': self.preprocessor is not None,
            'supervised_model_loaded': self.supervised_model is not None,
            'unsupervised_model_loaded': self.unsupervised_model is not None,
            'hybrid_config_loaded': self.hybrid_config is not None,
            'model_directory': str(self.model_dir),
        }

    def train_models(self, model_type: str = 'all', force: bool = False):
        """
        Train or retrain models.
        
        This is a placeholder - actual training would require training data.
        """
        logger.info(f"Training {model_type} models (force={force})")
        # Training implementation would go here
        pass


# Global singleton instance
_ml_service: Optional[MLService] = None


def get_ml_service() -> MLService:
    """Get the global ML service instance."""
    global _ml_service
    if _ml_service is None:
        _ml_service = MLService()
    return _ml_service
