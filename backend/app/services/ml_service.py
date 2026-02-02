"""ML Service for model loading and management"""
import pickle
import numpy as np
from pathlib import Path
from typing import Dict, Optional
import logging

from app.config import settings
from ml.models.hybrid import HybridDetectionEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MLService:
    """Service for managing ML models"""
    
    def __init__(self):
        self.hybrid_engine: Optional[HybridDetectionEngine] = None
        self.model_loaded = False
        self._load_hybrid_model()
    
    def _load_hybrid_model(self):
        """Load the hybrid detection model"""
        try:
            hybrid_model_path = Path(settings.HYBRID_MODEL_PATH) / "hybrid.pkl"
            
            if hybrid_model_path.exists():
                logger.info(f"Loading hybrid model from {hybrid_model_path}")
                with open(hybrid_model_path, 'rb') as f:
                    self.hybrid_engine = pickle.load(f)
                self.model_loaded = True
                logger.info("Hybrid model loaded successfully")
            else:
                # Initialize new hybrid engine (no hybrid.pkl yet — normal before first training)
                logger.info("No saved hybrid model found; initializing detection engine.")
                self.hybrid_engine = HybridDetectionEngine()
                self.hybrid_engine.load_models()
                self.model_loaded = True
                logger.info("Hybrid detection engine initialized (signature-based + ML when models are trained).")
        except Exception as e:
            logger.error(f"Error loading hybrid model: {e}")
            # Fallback: create new engine
            self.hybrid_engine = HybridDetectionEngine()
            self.model_loaded = False
    
    def save_hybrid_model(self):
        """Save the hybrid model to disk"""
        try:
            hybrid_model_path = Path(settings.HYBRID_MODEL_PATH) / "hybrid.pkl"
            hybrid_model_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(hybrid_model_path, 'wb') as f:
                pickle.dump(self.hybrid_engine, f)
            
            logger.info(f"Hybrid model saved to {hybrid_model_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving hybrid model: {e}")
            return False
    
    def get_model_status(self) -> Dict:
        """Get status of loaded models"""
        return {
            "hybrid_loaded": self.model_loaded and self.hybrid_engine is not None,
            "supervised_models": len(self.hybrid_engine.supervised_trainer.models) if self.hybrid_engine else 0,
            "unsupervised_models": len(self.hybrid_engine.unsupervised_trainer.models) if self.hybrid_engine else 0,
            "signature_engine": self.hybrid_engine.signature_engine is not None if self.hybrid_engine else False
        }
    
    def train_models(self, model_type: str = "all", force: bool = False):
        """Train models"""
        from app.services.model_service import ModelService
        
        model_service = ModelService()
        model_service.retrain_models(model_type=model_type, force=force)
        
        # Reload hybrid engine after training
        self._load_hybrid_model()
        
        # Save the hybrid model
        self.save_hybrid_model()
    
    def predict(self, packet_features: Dict, feature_vector: Optional[np.ndarray] = None) -> Dict:
        """Make prediction using hybrid model"""
        if not self.hybrid_engine:
            # Fallback: initialize new engine
            self._load_hybrid_model()
            if not self.hybrid_engine:
                raise ValueError("Hybrid model not loaded and could not be initialized")
        
        return self.hybrid_engine.detect(packet_features, feature_vector)

