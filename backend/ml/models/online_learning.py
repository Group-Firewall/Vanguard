"""Online learning using River library"""
import numpy as np
import pandas as pd
from typing import Dict, List, Optional
from pathlib import Path
import pickle
import logging

try:
    from river import tree, ensemble, linear_model, metrics, compose, preprocessing
    RIVER_AVAILABLE = True
except ImportError:
    RIVER_AVAILABLE = False
    logging.warning("River library not available. Online learning will be limited.")

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OnlineLearner:
    """Online learning for incremental model updates"""
    
    def __init__(self):
        if not RIVER_AVAILABLE:
            logger.warning("River not available. Using scikit-learn partial_fit instead.")
            self.use_river = False
        else:
            self.use_river = True
        
        self.models = {}
        self.metrics = {}
        self.model_path = Path(settings.MODEL_PATH) / "online"
        self.model_path.mkdir(parents=True, exist_ok=True)
    
    def create_river_model(self, model_type: str = 'adaptive_random_forest'):
        """Create a River-based online learning model"""
        if not RIVER_AVAILABLE:
            raise ImportError("River library not available")
        
        # Preprocessing pipeline
        preprocessor = compose.Pipeline(
            preprocessing.StandardScaler(),
        )
        
        # Model selection
        if model_type == 'adaptive_random_forest':
            model = ensemble.AdaptiveRandomForestClassifier(
                n_models=10,
                seed=42
            )
        elif model_type == 'hoeffding_tree':
            model = tree.HoeffdingTreeClassifier()
        elif model_type == 'logistic_regression':
            model = linear_model.LogisticRegression()
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        # Combine preprocessor and model
        pipeline = compose.Pipeline(preprocessor, model)
        
        return pipeline
    
    def create_sklearn_online_model(self, model_type: str = 'sgd'):
        """Create scikit-learn online learning model"""
        from sklearn.linear_model import SGDClassifier
        from sklearn.naive_bayes import MultinomialNB
        
        if model_type == 'sgd':
            model = SGDClassifier(
                loss='log_loss',
                learning_rate='adaptive',
                eta0=0.01,
                random_state=42
            )
        elif model_type == 'naive_bayes':
            model = MultinomialNB()
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        return model
    
    def train_online(
        self,
        model_name: str,
        X: np.ndarray,
        y: np.ndarray,
        model_type: str = 'adaptive_random_forest'
    ):
        """Train model incrementally"""
        if model_name not in self.models:
            if self.use_river:
                self.models[model_name] = self.create_river_model(model_type)
                self.metrics[model_name] = metrics.Accuracy()
            else:
                self.models[model_name] = self.create_sklearn_online_model(model_type)
                self.metrics[model_name] = {'accuracy': 0.0, 'samples_seen': 0}
        
        model = self.models[model_name]
        
        if self.use_river:
            # River: one sample at a time
            for i in range(len(X)):
                x_dict = {f'feature_{j}': float(X[i, j]) for j in range(X.shape[1])}
                y_true = int(y[i])
                
                # Predict
                y_pred = model.predict_one(x_dict)
                
                # Update
                model.learn_one(x_dict, y_true)
                self.metrics[model_name].update(y_true, y_pred)
        else:
            # scikit-learn: batch partial_fit
            if hasattr(model, 'partial_fit'):
                # Get unique classes for first fit
                if not hasattr(model, 'classes_'):
                    classes = np.unique(y)
                    model.partial_fit(X, y, classes=classes)
                else:
                    model.partial_fit(X, y)
                
                # Calculate accuracy
                y_pred = model.predict(X)
                accuracy = np.mean(y_pred == y)
                self.metrics[model_name]['accuracy'] = accuracy
                self.metrics[model_name]['samples_seen'] += len(X)
            else:
                # Fallback: full fit
                model.fit(X, y)
    
    def predict_online(self, model_name: str, X: np.ndarray) -> np.ndarray:
        """Make predictions with online model"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        
        model = self.models[model_name]
        
        if self.use_river:
            predictions = []
            for i in range(len(X)):
                x_dict = {f'feature_{j}': float(X[i, j]) for j in range(X.shape[1])}
                pred = model.predict_one(x_dict)
                predictions.append(pred)
            return np.array(predictions)
        else:
            return model.predict(X)
    
    def update_from_packet(
        self,
        model_name: str,
        packet_features: Dict,
        label: Optional[str] = None,
        feedback: Optional[bool] = None
    ):
        """Update model from a single packet with optional feedback"""
        # Convert packet features to feature vector
        feature_vector = np.array([v for k, v in packet_features.items() if isinstance(v, (int, float))])
        
        if label is not None:
            # Convert label to binary (0 = normal, 1 = attack)
            y = 0 if label.lower() in ['normal', 'benign'] else 1
            self.train_online(model_name, feature_vector.reshape(1, -1), np.array([y]))
        elif feedback is not None:
            # Use feedback (True = attack, False = normal)
            y = 1 if feedback else 0
            self.train_online(model_name, feature_vector.reshape(1, -1), np.array([y]))
    
    def save_model(self, model_name: str):
        """Save online learning model"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        
        model_file = self.model_path / f"{model_name}.pkl"
        
        if self.use_river:
            # River models can be pickled
            with open(model_file, 'wb') as f:
                pickle.dump(self.models[model_name], f)
        else:
            # scikit-learn models
            with open(model_file, 'wb') as f:
                pickle.dump(self.models[model_name], f)
        
        logger.info(f"Saved online model {model_name} to {model_file}")
    
    def load_model(self, model_name: str):
        """Load online learning model"""
        model_file = self.model_path / f"{model_name}.pkl"
        
        if not model_file.exists():
            raise FileNotFoundError(f"Model {model_name} not found at {model_file}")
        
        with open(model_file, 'rb') as f:
            model = pickle.load(f)
        
        self.models[model_name] = model
        logger.info(f"Loaded online model {model_name}")
    
    def get_metrics(self, model_name: str) -> Dict:
        """Get current model metrics"""
        if model_name not in self.metrics:
            return {}
        
        metric = self.metrics[model_name]
        
        if self.use_river:
            return {
                'accuracy': metric.get() if hasattr(metric, 'get') else 0.0
            }
        else:
            return metric


def main():
    """Test online learning"""
    learner = OnlineLearner()
    
    # Create synthetic data
    np.random.seed(42)
    X = np.random.randn(100, 10)
    y = (X[:, 0] > 0).astype(int)
    
    # Train online
    learner.train_online('test_model', X, y)
    
    # Predict
    predictions = learner.predict_online('test_model', X[:10])
    logger.info(f"Predictions: {predictions}")
    
    # Get metrics
    metrics = learner.get_metrics('test_model')
    logger.info(f"Metrics: {metrics}")


if __name__ == "__main__":
    main()

