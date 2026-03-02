"""
Unsupervised Anomaly Detection Models for Novel Threat Detection
Implements Isolation Forest, One-Class SVM, and Autoencoder
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc
import joblib
import time
import warnings
warnings.filterwarnings('ignore')

try:
    from tensorflow import keras
    from tensorflow.keras import layers
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    print("TensorFlow not available. Autoencoder will use sklearn's MLPRegressor.")


class UnsupervisedModelTrainer:
    """Trains and evaluates unsupervised models for novel threat detection"""
    
    def __init__(self):
        self.models = {}
        self.results = {}
        self.thresholds = {}
        
    def train_isolation_forest(self, X_train, X_val, y_val=None, **kwargs):
        """Train Isolation Forest for anomaly detection"""
        print("Training Isolation Forest...")
        start_time = time.time()
        
        iso_forest = IsolationForest(
            n_estimators=kwargs.get('n_estimators', 100),
            contamination=kwargs.get('contamination', 0.1),
            random_state=42,
            n_jobs=-1
        )
        
        iso_forest.fit(X_train)
        
        # Predict anomalies (1 = normal, -1 = anomaly)
        train_scores = iso_forest.decision_function(X_train)
        val_scores = iso_forest.decision_function(X_val)
        
        # Convert to anomaly scores (lower = more anomalous)
        train_anomaly_scores = -train_scores
        val_anomaly_scores = -val_scores
        
        # Set threshold based on training data
        threshold = np.percentile(train_anomaly_scores, 90)  # Top 10% as anomalies
        self.thresholds['isolation_forest'] = threshold
        
        # Evaluate if labels available
        metrics = {}
        if y_val is not None:
            y_pred = (val_anomaly_scores > threshold).astype(int)
            # Invert: 1 = anomaly, 0 = normal (matching y_val where 1 = intrusion)
            y_pred = 1 - y_pred  # Isolation Forest: -1 = anomaly, so we invert
            
            metrics = self._calculate_metrics(y_val, y_pred, val_anomaly_scores)
        
        metrics['training_time'] = time.time() - start_time
        metrics['threshold'] = threshold
        
        self.models['isolation_forest'] = iso_forest
        self.results['isolation_forest'] = metrics
        
        print(f"Isolation Forest - Threshold: {threshold:.4f}")
        if y_val is not None:
            print(f"  Accuracy: {metrics.get('accuracy', 0):.4f}, F1: {metrics.get('f1', 0):.4f}")
        
        return iso_forest, metrics
    
    def train_one_class_svm(self, X_train, X_val, y_val=None, **kwargs):
        """Train One-Class SVM for anomaly detection"""
        print("Training One-Class SVM...")
        start_time = time.time()
        
        oc_svm = OneClassSVM(
            nu=kwargs.get('nu', 0.1),  # Expected fraction of outliers
            kernel=kwargs.get('kernel', 'rbf'),
            gamma=kwargs.get('gamma', 'scale')
        )
        
        oc_svm.fit(X_train)
        
        # Get decision scores
        val_scores = oc_svm.decision_function(X_val)
        
        # Set threshold
        threshold = np.percentile(val_scores, 10)  # Bottom 10% as anomalies
        self.thresholds['one_class_svm'] = threshold
        
        # Evaluate if labels available
        metrics = {}
        if y_val is not None:
            y_pred = (val_scores < threshold).astype(int)  # Lower scores = anomalies
            metrics = self._calculate_metrics(y_val, y_pred, -val_scores)
        
        metrics['training_time'] = time.time() - start_time
        metrics['threshold'] = threshold
        
        self.models['one_class_svm'] = oc_svm
        self.results['one_class_svm'] = metrics
        
        print(f"One-Class SVM - Threshold: {threshold:.4f}")
        if y_val is not None:
            print(f"  Accuracy: {metrics.get('accuracy', 0):.4f}, F1: {metrics.get('f1', 0):.4f}")
        
        return oc_svm, metrics
    
    def train_autoencoder(self, X_train, X_val, y_val=None, **kwargs):
        """Train Autoencoder for anomaly detection"""
        print("Training Autoencoder...")
        start_time = time.time()
        
        input_dim = X_train.shape[1]
        encoding_dim = kwargs.get('encoding_dim', max(3, input_dim // 4))
        
        if TENSORFLOW_AVAILABLE:
            # Build autoencoder
            input_layer = layers.Input(shape=(input_dim,))
            encoded = layers.Dense(encoding_dim * 2, activation='relu')(input_layer)
            encoded = layers.Dense(encoding_dim, activation='relu')(encoded)
            decoded = layers.Dense(encoding_dim * 2, activation='relu')(encoded)
            decoded = layers.Dense(input_dim, activation='sigmoid')(decoded)
            
            autoencoder = keras.Model(input_layer, decoded)
            autoencoder.compile(optimizer='adam', loss='mse')
            
            # Train
            history = autoencoder.fit(
                X_train, X_train,
                epochs=kwargs.get('epochs', 50),
                batch_size=kwargs.get('batch_size', 32),
                validation_data=(X_val, X_val),
                verbose=0
            )
            
            # Calculate reconstruction errors
            train_reconstructions = autoencoder.predict(X_train, verbose=0)
            val_reconstructions = autoencoder.predict(X_val, verbose=0)
            
            train_errors = np.mean(np.square(X_train - train_reconstructions), axis=1)
            val_errors = np.mean(np.square(X_val - val_reconstructions), axis=1)
            
            # Set threshold
            threshold = np.percentile(train_errors, 90)
            self.thresholds['autoencoder'] = threshold
            
            # Evaluate if labels available
            metrics = {}
            if y_val is not None:
                y_pred = (val_errors > threshold).astype(int)
                metrics = self._calculate_metrics(y_val, y_pred, val_errors)
            
            metrics['training_time'] = time.time() - start_time
            metrics['threshold'] = threshold
            metrics['history'] = history.history
            
            self.models['autoencoder'] = autoencoder
            self.results['autoencoder'] = metrics
            
        else:
            # Fallback to simple reconstruction-based approach
            from sklearn.neural_network import MLPRegressor
            from sklearn.preprocessing import MinMaxScaler
            
            scaler = MinMaxScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_val_scaled = scaler.transform(X_val)
            
            mlp = MLPRegressor(
                hidden_layer_sizes=(encoding_dim * 2, encoding_dim, encoding_dim * 2),
                max_iter=kwargs.get('epochs', 200),
                random_state=42,
                verbose=False
            )
            
            mlp.fit(X_train_scaled, X_train_scaled)
            
            train_reconstructions = mlp.predict(X_train_scaled)
            val_reconstructions = mlp.predict(X_val_scaled)
            
            train_errors = np.mean(np.square(X_train_scaled - train_reconstructions), axis=1)
            val_errors = np.mean(np.square(X_val_scaled - val_reconstructions), axis=1)
            
            threshold = np.percentile(train_errors, 90)
            self.thresholds['autoencoder'] = threshold
            
            metrics = {}
            if y_val is not None:
                y_pred = (val_errors > threshold).astype(int)
                metrics = self._calculate_metrics(y_val, y_pred, val_errors)
            
            metrics['training_time'] = time.time() - start_time
            metrics['threshold'] = threshold
            
            self.models['autoencoder'] = {'model': mlp, 'scaler': scaler}
            self.results['autoencoder'] = metrics
        
        print(f"Autoencoder - Threshold: {threshold:.4f}")
        if y_val is not None:
            print(f"  Accuracy: {metrics.get('accuracy', 0):.4f}, F1: {metrics.get('f1', 0):.4f}")
        
        return self.models['autoencoder'], metrics
    
    def train_all(self, X_train, X_val, y_val=None):
        """Train all unsupervised models"""
        print("\n=== Training Unsupervised Models ===")
        
        self.train_isolation_forest(X_train, X_val, y_val)
        self.train_one_class_svm(X_train, X_val, y_val)
        self.train_autoencoder(X_train, X_val, y_val)
        
        return self.models, self.results
    
    def get_best_model(self):
        """Get the best performing model based on F1 score"""
        if not self.results:
            return None, None
        
        # Filter models with metrics
        models_with_metrics = {
            k: v for k, v in self.results.items() 
            if 'f1' in v and v['f1'] > 0
        }
        
        if not models_with_metrics:
            return None, None
        
        best_model_name = max(models_with_metrics.keys(), key=lambda k: models_with_metrics[k]['f1'])
        return best_model_name, self.models[best_model_name]
    
    def _calculate_metrics(self, y_true, y_pred, anomaly_scores):
        """Calculate evaluation metrics"""
        from sklearn.metrics import (
            accuracy_score, precision_score, recall_score, f1_score,
            confusion_matrix
        )
        
        return {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred, zero_division=0),
            'recall': recall_score(y_true, y_pred),
            'f1': f1_score(y_true, y_pred),
            'confusion_matrix': confusion_matrix(y_true, y_pred).tolist(),
            'tn': confusion_matrix(y_true, y_pred)[0, 0],
            'fp': confusion_matrix(y_true, y_pred)[0, 1],
            'fn': confusion_matrix(y_true, y_pred)[1, 0],
            'tp': confusion_matrix(y_true, y_pred)[1, 1]
        }
    
    def predict_anomaly(self, model_name, X):
        """Predict anomalies using a trained model"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        
        model = self.models[model_name]
        threshold = self.thresholds.get(model_name, 0)
        
        if model_name == 'isolation_forest':
            scores = -model.decision_function(X)
            return (scores > threshold).astype(int)
        elif model_name == 'one_class_svm':
            scores = model.decision_function(X)
            return (scores < threshold).astype(int)
        elif model_name == 'autoencoder':
            if TENSORFLOW_AVAILABLE:
                try:
                    reconstructions = model.predict(X, verbose=0)
                    errors = np.mean(np.square(X - reconstructions), axis=1)
                except:
                    # Fallback if model structure is different
                    return np.zeros(X.shape[0], dtype=int)
            else:
                if isinstance(model, dict) and 'scaler' in model:
                    scaler = model['scaler']
                    model_mlp = model['model']
                    X_scaled = scaler.transform(X)
                    reconstructions = model_mlp.predict(X_scaled)
                    errors = np.mean(np.square(X_scaled - reconstructions), axis=1)
                else:
                    return np.zeros(X.shape[0], dtype=int)
            return (errors > threshold).astype(int)
        else:
            raise ValueError(f"Unknown model: {model_name}")
    
    def save_model(self, model_name, filepath):
        """Save a model to disk"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        joblib.dump({
            'model': self.models[model_name],
            'threshold': self.thresholds.get(model_name)
        }, filepath)
    
    def load_model(self, model_name, filepath):
        """Load a model from disk"""
        data = joblib.load(filepath)
        self.models[model_name] = data['model']
        if 'threshold' in data:
            self.thresholds[model_name] = data['threshold']
        return self.models[model_name]
