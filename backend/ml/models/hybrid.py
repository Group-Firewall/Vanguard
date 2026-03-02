"""
Hybrid Detection System
Combines signature-based and ML-based detection with fusion algorithm
"""

import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional, List
import joblib
import logging

# Clean imports - no sys.path hacks
from backend.ml.models.signature_detection import SignatureDetector
from backend.ml.models.supervised import SupervisedModelTrainer
from backend.ml.models.unsupervised import UnsupervisedModelTrainer

logger = logging.getLogger(__name__)


class HybridDetector:
    """
    Hybrid NIDS combining signature-based and ML-based detection
    
    Fusion Algorithm:
    1. Signature detection runs first (fast, deterministic)
    2. If signature detects attack with high confidence (>0.8), flag immediately
    3. If signature confidence is medium (0.5-0.8), use ML models for confirmation
    4. If signature confidence is low (<0.5), rely primarily on ML models
    5. Combine ML predictions using weighted voting
    6. Final decision based on fusion rules
    """
    
    def __init__(self, 
                 supervised_model_name: str = 'random_forest',
                 unsupervised_model_name: str = 'isolation_forest',
                 signature_weight: float = 0.3,
                 supervised_weight: float = 0.5,
                 unsupervised_weight: float = 0.2):
        """
        Initialize hybrid detector
        
        Args:
            supervised_model_name: Name of supervised model to use
            unsupervised_model_name: Name of unsupervised model to use
            signature_weight: Weight for signature-based detection
            supervised_weight: Weight for supervised ML detection
            unsupervised_weight: Weight for unsupervised ML detection
        """
        self.signature_detector = SignatureDetector()
        self.supervised_model_name = supervised_model_name
        self.unsupervised_model_name = unsupervised_model_name
        
        # Weights for fusion (should sum to 1.0)
        total_weight = signature_weight + supervised_weight + unsupervised_weight
        self.signature_weight = signature_weight / total_weight
        self.supervised_weight = supervised_weight / total_weight
        self.unsupervised_weight = unsupervised_weight / total_weight
        
        # Model references (to be set after training)
        self.supervised_model = None
        self.unsupervised_model = None
        self.preprocessor = None
        
        # Statistics
        self.stats = {
            'signature_detections': 0,
            'ml_detections': 0,
            'hybrid_detections': 0,
            'conflicts': 0
        }
    
    def set_models(self, supervised_model, unsupervised_model, preprocessor):
        """Set trained models and preprocessor"""
        self.supervised_model = supervised_model
        self.unsupervised_model = unsupervised_model
        self.preprocessor = preprocessor
    
    def detect(self, row: pd.Series, X_processed: Optional[np.ndarray] = None) -> Dict:
        """
        Detect intrusion using hybrid approach
        
        Returns:
            Dictionary with detection results
        """
        # Step 1: Signature-based detection
        sig_attack, sig_confidence, sig_name = self.signature_detector.detect(row)
        
        # Step 2: ML-based detection (if features available)
        ml_attack = False
        ml_confidence = 0.0
        supervised_pred = 0
        unsupervised_pred = 0
        
        if X_processed is not None and self.supervised_model is not None and self.unsupervised_model is not None:
            # Supervised prediction
            try:
                supervised_proba = self.supervised_model.predict_proba(X_processed.reshape(1, -1))[0]
                supervised_pred = self.supervised_model.predict(X_processed.reshape(1, -1))[0]
                supervised_confidence = supervised_proba[1] if len(supervised_proba) > 1 else supervised_proba[0]
            except:
                supervised_pred = 0
                supervised_confidence = 0.0
            
            # Unsupervised prediction
            try:
                unsupervised_pred = self.unsupervised_model.predict_anomaly(
                    self.unsupervised_model_name, 
                    X_processed.reshape(1, -1)
                )[0]
                # Get anomaly score for confidence
                if self.unsupervised_model_name == 'isolation_forest':
                    score = -self.unsupervised_model.models[self.unsupervised_model_name].decision_function(
                        X_processed.reshape(1, -1)
                    )[0]
                    unsupervised_confidence = min(1.0, max(0.0, (score - 0) / 2))  # Normalize
                else:
                    unsupervised_confidence = 0.7 if unsupervised_pred == 1 else 0.3
            except:
                unsupervised_pred = 0
                unsupervised_confidence = 0.0
            
            # Combine ML predictions
            ml_confidence = (
                self.supervised_weight * supervised_confidence +
                self.unsupervised_weight * unsupervised_confidence
            )
            ml_attack = (
                (self.supervised_weight * supervised_pred + 
                 self.unsupervised_weight * unsupervised_pred) > 0.5
            )
        
        # Step 3: Fusion Algorithm
        final_decision, fusion_confidence, conflict = self._fuse_decisions(
            sig_attack, sig_confidence,
            ml_attack, ml_confidence
        )
        
        # Update statistics
        if sig_attack:
            self.stats['signature_detections'] += 1
        if ml_attack:
            self.stats['ml_detections'] += 1
        if final_decision:
            self.stats['hybrid_detections'] += 1
        if conflict:
            self.stats['conflicts'] += 1
        
        return {
            'is_attack': final_decision,
            'confidence': fusion_confidence,
            'signature_detected': sig_attack,
            'signature_confidence': sig_confidence,
            'signature_name': sig_name,
            'ml_detected': ml_attack,
            'ml_confidence': ml_confidence,
            'supervised_prediction': int(supervised_pred),
            'unsupervised_prediction': int(unsupervised_pred),
            'conflict': conflict,
            'decision_path': self._get_decision_path(sig_confidence, ml_confidence, final_decision)
        }
    
    def _fuse_decisions(self, sig_attack: bool, sig_confidence: float,
                       ml_attack: bool, ml_confidence: float) -> Tuple[bool, float, bool]:
        """
        Fusion Algorithm Pseudocode:
        
        IF signature_confidence > 0.8:
            RETURN (attack=True, confidence=signature_confidence, conflict=False)
        ELIF signature_confidence > 0.5:
            IF ml_confidence > 0.6:
                RETURN (attack=True, confidence=weighted_average, conflict=False)
            ELSE:
                RETURN (attack=False, confidence=1-signature_confidence, conflict=True)
        ELSE:
            IF ml_confidence > 0.7:
                RETURN (attack=True, confidence=ml_confidence, conflict=False)
            ELSE:
                RETURN (attack=False, confidence=1-ml_confidence, conflict=False)
        """
        conflict = False
        
        # High signature confidence - trust signature
        if sig_confidence > 0.8:
            return True, sig_confidence, False
        
        # Medium signature confidence - use ML for confirmation
        elif sig_confidence > 0.5:
            if ml_confidence > 0.6:
                # Both agree on attack
                fused_confidence = (
                    self.signature_weight * sig_confidence +
                    (self.supervised_weight + self.unsupervised_weight) * ml_confidence
                )
                return True, fused_confidence, False
            else:
                # Conflict: signature says attack, ML says normal
                conflict = True
                # Trust ML more for low confidence signatures
                return False, 1 - sig_confidence, conflict
        
        # Low signature confidence - rely on ML
        else:
            if ml_confidence > 0.7:
                return True, ml_confidence, False
            else:
                return False, 1 - ml_confidence, False
    
    def _get_decision_path(self, sig_confidence: float, ml_confidence: float, 
                          final_decision: bool) -> str:
        """Get human-readable decision path"""
        if sig_confidence > 0.8:
            return "signature_high_confidence"
        elif sig_confidence > 0.5:
            if ml_confidence > 0.6:
                return "signature_ml_agreement"
            else:
                return "signature_ml_conflict"
        else:
            if ml_confidence > 0.7:
                return "ml_high_confidence"
            else:
                return "ml_low_confidence"
    
    def detect_batch(self, df: pd.DataFrame) -> pd.DataFrame:
        """Detect attacks in a batch of data"""
        results = []
        
        # Preprocess if preprocessor available
        if self.preprocessor is not None:
            try:
                X_processed = self.preprocessor.transform(df)
            except:
                X_processed = None
        else:
            X_processed = None
        
        for i, (idx, row) in enumerate(df.iterrows()):
            if X_processed is not None:
                # Use enumerate index since X_processed has reset index
                X_row = X_processed.iloc[i].values if hasattr(X_processed, 'iloc') else X_processed[i]
            else:
                X_row = None
            
            result = self.detect(row, X_row)
            result['index'] = idx
            results.append(result)
        
        return pd.DataFrame(results)
    
    def get_statistics(self) -> Dict:
        """Get detection statistics"""
        return self.stats.copy()
    
    def reset_statistics(self):
        """Reset detection statistics"""
        self.stats = {
            'signature_detections': 0,
            'ml_detections': 0,
            'hybrid_detections': 0,
            'conflicts': 0
        }
    
    def save(self, filepath: str):
        """Save hybrid detector"""
        joblib.dump({
            'supervised_model_name': self.supervised_model_name,
            'unsupervised_model_name': self.unsupervised_model_name,
            'signature_weight': self.signature_weight,
            'supervised_weight': self.supervised_weight,
            'unsupervised_weight': self.unsupervised_weight,
            'stats': self.stats
        }, filepath)
    
    def load(self, filepath: str):
        """Load hybrid detector configuration"""
        data = joblib.load(filepath)
        self.supervised_model_name = data['supervised_model_name']
        self.unsupervised_model_name = data['unsupervised_model_name']
        self.signature_weight = data['signature_weight']
        self.supervised_weight = data['supervised_weight']
        self.unsupervised_weight = data['unsupervised_weight']
        self.stats = data.get('stats', self.stats)
