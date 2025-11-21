"""SHAP analysis for model explainability"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional
import logging

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    logging.warning("SHAP library not available")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SHAPAnalyzer:
    """SHAP value analysis for model explainability"""
    
    def __init__(self):
        self.explainers = {}
    
    def create_explainer(self, model, X_sample: np.ndarray, model_type: str = 'tree'):
        """Create SHAP explainer for a model"""
        if not SHAP_AVAILABLE:
            logger.warning("SHAP not available")
            return None
        
        try:
            if model_type == 'tree':
                explainer = shap.TreeExplainer(model)
            elif model_type == 'linear':
                explainer = shap.LinearExplainer(model, X_sample)
            else:
                explainer = shap.KernelExplainer(model.predict, X_sample)
            
            return explainer
        except Exception as e:
            logger.error(f"Error creating SHAP explainer: {e}")
            return None
    
    def calculate_shap_values(
        self,
        model,
        X: np.ndarray,
        feature_names: Optional[List[str]] = None,
        model_type: str = 'tree'
    ) -> Dict:
        """Calculate SHAP values for predictions"""
        if not SHAP_AVAILABLE:
            return {
                'shap_values': None,
                'feature_names': feature_names or [],
                'error': 'SHAP library not available'
            }
        
        try:
            # Sample data if too large
            if len(X) > 1000:
                logger.info("Sampling data for SHAP analysis")
                indices = np.random.choice(len(X), size=1000, replace=False)
                X_sample = X[indices]
            else:
                X_sample = X
            
            # Create explainer
            explainer = self.create_explainer(model, X_sample, model_type)
            if explainer is None:
                return {
                    'shap_values': None,
                    'feature_names': feature_names or [],
                    'error': 'Could not create explainer'
                }
            
            # Calculate SHAP values
            shap_values = explainer.shap_values(X_sample)
            
            # Handle different output formats
            if isinstance(shap_values, list):
                # Multi-class output
                shap_values = shap_values[1]  # Use positive class
            
            return {
                'shap_values': shap_values.tolist() if isinstance(shap_values, np.ndarray) else shap_values,
                'feature_names': feature_names or [f'feature_{i}' for i in range(X.shape[1])],
                'base_value': float(explainer.expected_value) if hasattr(explainer, 'expected_value') else None
            }
        except Exception as e:
            logger.error(f"Error calculating SHAP values: {e}")
            return {
                'shap_values': None,
                'feature_names': feature_names or [],
                'error': str(e)
            }
    
    def get_feature_importance_from_shap(self, shap_values: np.ndarray, feature_names: List[str]) -> Dict:
        """Get feature importance from SHAP values"""
        if shap_values is None:
            return {}
        
        # Calculate mean absolute SHAP values
        mean_shap = np.abs(shap_values).mean(axis=0)
        
        # Create feature importance dictionary
        importance = {
            name: float(value) for name, value in zip(feature_names, mean_shap)
        }
        
        # Sort by importance
        sorted_importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
        
        return sorted_importance

