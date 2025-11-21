"""Feature importance analysis using permutation importance"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional
from sklearn.inspection import permutation_importance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FeatureImportanceAnalyzer:
    """Analyze feature importance using permutation importance"""
    
    def __init__(self):
        self.importance_cache = {}
    
    def calculate_permutation_importance(
        self,
        model,
        model_name: str,
        X: Optional[np.ndarray] = None,
        y: Optional[np.ndarray] = None,
        feature_names: Optional[List[str]] = None,
        n_repeats: int = 10,
        random_state: int = 42
    ) -> Dict:
        """Calculate permutation importance for a model"""
        try:
            # If no data provided, try to get from model
            if X is None or y is None:
                # Try to use cached importance
                if model_name in self.importance_cache:
                    return self.importance_cache[model_name]
                
                # If model has feature_importances_ attribute
                if hasattr(model, 'feature_importances_'):
                    importances = model.feature_importances_
                    feature_names = feature_names or [f'feature_{i}' for i in range(len(importances))]
                    
                    importance_dict = {
                        name: float(imp) for name, imp in zip(feature_names, importances)
                    }
                    
                    # Sort by importance
                    sorted_importance = dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
                    self.importance_cache[model_name] = sorted_importance
                    return sorted_importance
                
                return {}
            
            # Calculate permutation importance
            perm_importance = permutation_importance(
                model,
                X,
                y,
                n_repeats=n_repeats,
                random_state=random_state,
                n_jobs=-1
            )
            
            # Create feature names if not provided
            if feature_names is None:
                feature_names = [f'feature_{i}' for i in range(X.shape[1])]
            
            # Create importance dictionary
            importance_dict = {
                name: {
                    'importance_mean': float(mean),
                    'importance_std': float(std)
                }
                for name, mean, std in zip(
                    feature_names,
                    perm_importance.importances_mean,
                    perm_importance.importances_std
                )
            }
            
            # Sort by importance
            sorted_importance = dict(sorted(
                importance_dict.items(),
                key=lambda x: x[1]['importance_mean'],
                reverse=True
            ))
            
            # Cache result
            self.importance_cache[model_name] = sorted_importance
            
            return sorted_importance
        except Exception as e:
            logger.error(f"Error calculating permutation importance: {e}")
            return {}
    
    def get_top_features(self, importance_dict: Dict, top_n: int = 10) -> List[Dict]:
        """Get top N important features"""
        items = list(importance_dict.items())[:top_n]
        
        result = []
        for feature_name, importance_data in items:
            if isinstance(importance_data, dict):
                result.append({
                    'feature': feature_name,
                    'importance': importance_data.get('importance_mean', 0.0),
                    'std': importance_data.get('importance_std', 0.0)
                })
            else:
                result.append({
                    'feature': feature_name,
                    'importance': float(importance_data),
                    'std': 0.0
                })
        
        return result
    
    def plot_feature_importance(self, importance_dict: Dict, top_n: int = 20):
        """Plot feature importance (returns plot data for frontend)"""
        top_features = self.get_top_features(importance_dict, top_n)
        
        return {
            'features': [f['feature'] for f in top_features],
            'importance': [f['importance'] for f in top_features],
            'std': [f['std'] for f in top_features]
        }

