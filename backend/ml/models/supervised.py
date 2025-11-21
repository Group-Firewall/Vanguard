"""Supervised learning models for known attack detection"""
import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SupervisedModelTrainer:
    """Train and manage supervised learning models"""
    
    def __init__(self, model_path: Optional[Path] = None):
        if model_path is None:
            try:
                from app.config import settings
            except ImportError:
                import sys
                from pathlib import Path as P
                sys.path.insert(0, str(P(__file__).parent.parent.parent))
                from app.config import settings
            model_path = Path(settings.SUPERVISED_MODEL_PATH)
        self.model_path = model_path
        self.model_path.mkdir(parents=True, exist_ok=True)
        self.models = {}
        self.feature_names = []
    
    def prepare_data(self, df: pd.DataFrame, label_col: str = 'label') -> Tuple[np.ndarray, np.ndarray]:
        """Prepare data for training"""
        if label_col not in df.columns:
            raise ValueError(f"Label column '{label_col}' not found in dataframe")
        
        # Separate features and labels
        X = df.drop(columns=[label_col]).select_dtypes(include=[np.number]).values
        y = df[label_col].values
        
        # Store feature names
        self.feature_names = df.drop(columns=[label_col]).select_dtypes(include=[np.number]).columns.tolist()
        
        return X, y
    
    def train_random_forest(
        self,
        X: np.ndarray,
        y: np.ndarray,
        n_estimators: int = 100,
        max_depth: Optional[int] = None,
        random_state: int = 42
    ) -> RandomForestClassifier:
        """Train Random Forest model"""
        logger.info("Training Random Forest model...")
        
        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            n_jobs=-1,
            verbose=1
        )
        
        model.fit(X, y)
        self.models['random_forest'] = model
        
        # Save model
        model_file = self.model_path / "random_forest.pkl"
        with open(model_file, 'wb') as f:
            pickle.dump(model, f)
        
        logger.info(f"Random Forest model saved to {model_file}")
        return model
    
    def train_svm(
        self,
        X: np.ndarray,
        y: np.ndarray,
        kernel: str = 'rbf',
        C: float = 1.0,
        random_state: int = 42
    ) -> SVC:
        """Train SVM model"""
        logger.info("Training SVM model...")
        
        # For large datasets, use linear kernel or sample
        if len(X) > 10000:
            logger.warning("Large dataset detected. Using linear kernel for efficiency.")
            kernel = 'linear'
            # Sample for training
            indices = np.random.choice(len(X), size=10000, replace=False)
            X = X[indices]
            y = y[indices]
        
        model = SVC(
            kernel=kernel,
            C=C,
            probability=True,
            random_state=random_state,
            verbose=True
        )
        
        model.fit(X, y)
        self.models['svm'] = model
        
        # Save model
        model_file = self.model_path / "svm.pkl"
        with open(model_file, 'wb') as f:
            pickle.dump(model, f)
        
        logger.info(f"SVM model saved to {model_file}")
        return model
    
    def train_xgboost(
        self,
        X: np.ndarray,
        y: np.ndarray,
        n_estimators: int = 100,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        random_state: int = 42
    ) -> XGBClassifier:
        """Train XGBoost model"""
        logger.info("Training XGBoost model...")
        
        model = XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            random_state=random_state,
            n_jobs=-1,
            verbosity=1
        )
        
        model.fit(X, y)
        self.models['xgboost'] = model
        
        # Save model
        model_file = self.model_path / "xgboost.pkl"
        with open(model_file, 'wb') as f:
            pickle.dump(model, f)
        
        logger.info(f"XGBoost model saved to {model_file}")
        return model
    
    def train_lightgbm(
        self,
        X: np.ndarray,
        y: np.ndarray,
        n_estimators: int = 100,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        random_state: int = 42
    ) -> LGBMClassifier:
        """Train LightGBM model"""
        logger.info("Training LightGBM model...")
        
        model = LGBMClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            random_state=random_state,
            n_jobs=-1,
            verbose=1
        )
        
        model.fit(X, y)
        self.models['lightgbm'] = model
        
        # Save model
        model_file = self.model_path / "lightgbm.pkl"
        with open(model_file, 'wb') as f:
            pickle.dump(model, f)
        
        logger.info(f"LightGBM model saved to {model_file}")
        return model
    
    def train_all_models(
        self,
        df: pd.DataFrame,
        test_size: float = 0.2,
        label_col: str = 'label'
    ) -> Dict[str, Dict]:
        """Train all supervised models"""
        logger.info("Training all supervised models...")
        
        # Prepare data
        X, y = self.prepare_data(df, label_col)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        logger.info(f"Training set: {len(X_train)}, Test set: {len(X_test)}")
        
        # Train models
        self.train_random_forest(X_train, y_train)
        self.train_svm(X_train, y_train)
        self.train_xgboost(X_train, y_train)
        self.train_lightgbm(X_train, y_train)
        
        # Evaluate all models
        results = {}
        for model_name, model in self.models.items():
            results[model_name] = self.evaluate_model(model, X_test, y_test)
        
        return results
    
    def evaluate_model(
        self,
        model,
        X_test: np.ndarray,
        y_test: np.ndarray
    ) -> Dict:
        """Evaluate a model"""
        import time
        
        start_time = time.time()
        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test) if hasattr(model, 'predict_proba') else None
        latency_ms = (time.time() - start_time) * 1000 / len(X_test)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        
        # ROC-AUC (for binary classification or multi-class)
        roc_auc = None
        pr_auc = None
        if y_pred_proba is not None:
            try:
                if len(np.unique(y_test)) == 2:
                    roc_auc = roc_auc_score(y_test, y_pred_proba[:, 1])
                    pr_auc = average_precision_score(y_test, y_pred_proba[:, 1])
                else:
                    roc_auc = roc_auc_score(y_test, y_pred_proba, multi_class='ovr', average='weighted')
                    pr_auc = average_precision_score(y_test, y_pred_proba, average='weighted')
            except Exception as e:
                logger.warning(f"Could not calculate AUC: {e}")
        
        # False positive rate
        cm = confusion_matrix(y_test, y_pred)
        fp_rate = 0.0
        if cm.size > 0:
            tn = cm[0, 0] if cm.shape == (2, 2) else 0
            fp = cm[0, 1] if cm.shape == (2, 2) else cm.sum(axis=0) - np.diag(cm)
            fp_rate = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        
        return {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'roc_auc': float(roc_auc) if roc_auc is not None else None,
            'pr_auc': float(pr_auc) if pr_auc is not None else None,
            'false_positive_rate': float(fp_rate),
            'latency_ms': float(latency_ms)
        }
    
    def load_model(self, model_name: str):
        """Load a saved model"""
        model_file = self.model_path / f"{model_name}.pkl"
        if not model_file.exists():
            raise FileNotFoundError(f"Model {model_name} not found at {model_file}")
        
        with open(model_file, 'rb') as f:
            model = pickle.load(f)
        
        self.models[model_name] = model
        return model
    
    def predict(self, model_name: str, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Make predictions with a model"""
        if model_name not in self.models:
            self.load_model(model_name)
        
        model = self.models[model_name]
        predictions = model.predict(X)
        probabilities = model.predict_proba(X) if hasattr(model, 'predict_proba') else None
        
        return predictions, probabilities


def main():
    """Main entry point for training"""
    import sys
    from pathlib import Path as P
    sys.path.insert(0, str(P(__file__).parent.parent.parent))
    from app.config import settings
    import pandas as pd
    
    # Load merged dataset
    data_path = Path(settings.DATA_PATH) / "merged_dataset.parquet"
    if not data_path.exists():
        logger.error(f"Dataset not found at {data_path}. Please run data pipeline first.")
        return
    
    df = pd.read_parquet(data_path)
    logger.info(f"Loaded dataset with {len(df)} records")
    
    # Train models
    trainer = SupervisedModelTrainer()
    results = trainer.train_all_models(df)
    
    # Print results
    for model_name, metrics in results.items():
        logger.info(f"\n{model_name.upper()} Results:")
        for metric, value in metrics.items():
            logger.info(f"  {metric}: {value}")


if __name__ == "__main__":
    main()

