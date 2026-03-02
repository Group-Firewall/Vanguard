"""
Supervised ML Models for Known Threat Detection
Implements Random Forest, Logistic Regression, and XGBoost
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
from xgboost import XGBClassifier
import joblib
import time


class SupervisedModelTrainer:
    """Trains and evaluates supervised models for known threat detection"""
    
    def __init__(self):
        self.models = {}
        self.results = {}
        
    def train_random_forest(self, X_train, y_train, X_val, y_val, **kwargs):
        """Train Random Forest classifier"""
        print("Training Random Forest...")
        start_time = time.time()
        
        rf = RandomForestClassifier(
            n_estimators=kwargs.get('n_estimators', 100),
            max_depth=kwargs.get('max_depth', 20),
            min_samples_split=kwargs.get('min_samples_split', 5),
            min_samples_leaf=kwargs.get('min_samples_leaf', 2),
            random_state=42,
            n_jobs=-1,
            class_weight='balanced'
        )
        
        rf.fit(X_train, y_train)
        
        # Evaluate
        y_pred = rf.predict(X_val)
        y_pred_proba = rf.predict_proba(X_val)[:, 1]
        
        metrics = self._calculate_metrics(y_val, y_pred, y_pred_proba)
        metrics['training_time'] = time.time() - start_time
        metrics['feature_importance'] = dict(zip(
            [f'feature_{i}' for i in range(len(rf.feature_importances_))],
            rf.feature_importances_
        ))
        
        self.models['random_forest'] = rf
        self.results['random_forest'] = metrics
        
        print(f"Random Forest - Accuracy: {metrics['accuracy']:.4f}, F1: {metrics['f1']:.4f}")
        return rf, metrics
    
    def train_logistic_regression(self, X_train, y_train, X_val, y_val, **kwargs):
        """Train Logistic Regression classifier"""
        print("Training Logistic Regression...")
        start_time = time.time()
        
        lr = LogisticRegression(
            max_iter=kwargs.get('max_iter', 1000),
            C=kwargs.get('C', 1.0),
            class_weight='balanced',
            random_state=42,
            solver='lbfgs'
        )
        
        lr.fit(X_train, y_train)
        
        # Evaluate
        y_pred = lr.predict(X_val)
        y_pred_proba = lr.predict_proba(X_val)[:, 1]
        
        metrics = self._calculate_metrics(y_val, y_pred, y_pred_proba)
        metrics['training_time'] = time.time() - start_time
        metrics['feature_importance'] = dict(zip(
            [f'feature_{i}' for i in range(len(lr.coef_[0]))],
            np.abs(lr.coef_[0])
        ))
        
        self.models['logistic_regression'] = lr
        self.results['logistic_regression'] = metrics
        
        print(f"Logistic Regression - Accuracy: {metrics['accuracy']:.4f}, F1: {metrics['f1']:.4f}")
        return lr, metrics
    
    def train_xgboost(self, X_train, y_train, X_val, y_val, **kwargs):
        """Train XGBoost classifier"""
        print("Training XGBoost...")
        start_time = time.time()
        
        xgb = XGBClassifier(
            n_estimators=kwargs.get('n_estimators', 100),
            max_depth=kwargs.get('max_depth', 6),
            learning_rate=kwargs.get('learning_rate', 0.1),
            random_state=42,
            scale_pos_weight=kwargs.get('scale_pos_weight', None),
            eval_metric='logloss'
        )
        
        xgb.fit(X_train, y_train)
        
        # Evaluate
        y_pred = xgb.predict(X_val)
        y_pred_proba = xgb.predict_proba(X_val)[:, 1]
        
        metrics = self._calculate_metrics(y_val, y_pred, y_pred_proba)
        metrics['training_time'] = time.time() - start_time
        metrics['feature_importance'] = dict(zip(
            [f'feature_{i}' for i in range(len(xgb.feature_importances_))],
            xgb.feature_importances_
        ))
        
        self.models['xgboost'] = xgb
        self.results['xgboost'] = metrics
        
        print(f"XGBoost - Accuracy: {metrics['accuracy']:.4f}, F1: {metrics['f1']:.4f}")
        return xgb, metrics
    
    def train_all(self, X_train, y_train, X_val, y_val):
        """Train all supervised models"""
        print("\n=== Training Supervised Models ===")
        
        # Calculate scale_pos_weight for XGBoost
        scale_pos_weight = (y_train == 0).sum() / (y_train == 1).sum()
        
        self.train_random_forest(X_train, y_train, X_val, y_val)
        self.train_logistic_regression(X_train, y_train, X_val, y_val)
        self.train_xgboost(X_train, y_train, X_val, y_val, scale_pos_weight=scale_pos_weight)
        
        return self.models, self.results
    
    def get_best_model(self):
        """Get the best performing model based on F1 score"""
        if not self.results:
            return None, None
        
        best_model_name = max(self.results.keys(), key=lambda k: self.results[k]['f1'])
        return best_model_name, self.models[best_model_name]
    
    def _calculate_metrics(self, y_true, y_pred, y_pred_proba):
        """Calculate evaluation metrics"""
        return {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision': precision_score(y_true, y_pred, zero_division=0),
            'recall': recall_score(y_true, y_pred),
            'f1': f1_score(y_true, y_pred),
            'roc_auc': roc_auc_score(y_true, y_pred_proba) if len(np.unique(y_true)) > 1 else 0,
            'confusion_matrix': confusion_matrix(y_true, y_pred).tolist(),
            'tn': confusion_matrix(y_true, y_pred)[0, 0],
            'fp': confusion_matrix(y_true, y_pred)[0, 1],
            'fn': confusion_matrix(y_true, y_pred)[1, 0],
            'tp': confusion_matrix(y_true, y_pred)[1, 1]
        }
    
    def predict(self, model_name, X):
        """Make predictions using a trained model"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        return self.models[model_name].predict(X)
    
    def predict_proba(self, model_name, X):
        """Get prediction probabilities"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        return self.models[model_name].predict_proba(X)
    
    def save_model(self, model_name, filepath):
        """Save a model to disk"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        joblib.dump(self.models[model_name], filepath)
    
    def load_model(self, model_name, filepath):
        """Load a model from disk"""
        self.models[model_name] = joblib.load(filepath)
        return self.models[model_name]

