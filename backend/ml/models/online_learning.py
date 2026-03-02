"""
Online Learning Module for Adaptive Model Updates

This module provides incremental learning capabilities for the NIDS,
allowing models to adapt to new attack patterns without full retraining.
"""

import numpy as np
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class OnlineLearner:
    """
    Online learning system for adaptive model updates.
    
    Supports incremental updates to models as new data becomes available,
    enabling the NIDS to adapt to evolving threats.
    """
    
    def __init__(self, learning_rate: float = 0.01, window_size: int = 1000):
        self.learning_rate = learning_rate
        self.window_size = window_size
        self.sample_buffer: List[Dict] = []
        self.label_buffer: List[int] = []
        self.update_count = 0
        self.last_update: Optional[datetime] = None
        self.metrics_history: List[Dict] = []
        
        logger.info(f"OnlineLearner initialized (lr={learning_rate}, window={window_size})")
    
    def add_sample(self, features: Dict, label: int) -> None:
        """
        Add a new sample to the learning buffer.
        
        Args:
            features: Dictionary of feature values
            label: Ground truth label (0=normal, 1=attack)
        """
        self.sample_buffer.append(features)
        self.label_buffer.append(label)
        
        # Maintain window size
        if len(self.sample_buffer) > self.window_size:
            self.sample_buffer = self.sample_buffer[-self.window_size:]
            self.label_buffer = self.label_buffer[-self.window_size:]
    
    def should_update(self, min_samples: int = 100) -> bool:
        """
        Check if we have enough new samples to trigger an update.
        
        Args:
            min_samples: Minimum number of new samples required
            
        Returns:
            True if update should be performed
        """
        return len(self.sample_buffer) >= min_samples
    
    def update_model(self, model: Any) -> Optional[Dict]:
        """
        Perform incremental update on the model.
        
        Note: This is a placeholder - actual implementation depends on
        the model type (sklearn models typically don't support online learning,
        would need to use partial_fit or retrain with recent data).
        
        Args:
            model: The model to update
            
        Returns:
            Dictionary with update metrics, or None if update failed
        """
        if not self.sample_buffer:
            return None
        
        try:
            # Check if model supports partial_fit
            if hasattr(model, 'partial_fit'):
                X = self._features_to_array(self.sample_buffer)
                y = np.array(self.label_buffer)
                model.partial_fit(X, y, classes=[0, 1])
                
                self.update_count += 1
                self.last_update = datetime.now()
                
                metrics = {
                    'update_count': self.update_count,
                    'samples_used': len(self.sample_buffer),
                    'timestamp': self.last_update.isoformat()
                }
                self.metrics_history.append(metrics)
                
                # Clear buffer after successful update
                self.sample_buffer = []
                self.label_buffer = []
                
                logger.info(f"Online update #{self.update_count} completed")
                return metrics
            else:
                logger.warning("Model does not support partial_fit - skipping online update")
                return None
                
        except Exception as e:
            logger.error(f"Online update failed: {e}")
            return None
    
    def _features_to_array(self, samples: List[Dict]) -> np.ndarray:
        """Convert list of feature dicts to numpy array."""
        if not samples:
            return np.array([])
        
        # Get all feature keys from first sample
        keys = list(samples[0].keys())
        
        # Build feature matrix
        X = np.zeros((len(samples), len(keys)))
        for i, sample in enumerate(samples):
            for j, key in enumerate(keys):
                try:
                    X[i, j] = float(sample.get(key, 0))
                except (ValueError, TypeError):
                    X[i, j] = 0.0
        
        return X
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get online learning statistics."""
        return {
            'buffer_size': len(self.sample_buffer),
            'update_count': self.update_count,
            'last_update': self.last_update.isoformat() if self.last_update else None,
            'learning_rate': self.learning_rate,
            'window_size': self.window_size,
        }
    
    def reset(self) -> None:
        """Reset the online learner state."""
        self.sample_buffer = []
        self.label_buffer = []
        self.update_count = 0
        self.last_update = None
        self.metrics_history = []
        logger.info("OnlineLearner reset")
