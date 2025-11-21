"""Model service for managing ML models"""
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import logging

from ml.models.supervised import SupervisedModelTrainer
from ml.models.unsupervised import UnsupervisedModelTrainer
from ml.models.online_learning import OnlineLearner
from ml.explainability.shap_analysis import SHAPAnalyzer
from ml.explainability.feature_importance import FeatureImportanceAnalyzer
from app.config import settings
from app.models import ModelPerformance
from app.database import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelService:
    """Service for managing ML models"""
    
    def __init__(self):
        self.supervised_trainer = SupervisedModelTrainer()
        self.unsupervised_trainer = UnsupervisedModelTrainer()
        self.online_learner = OnlineLearner()
        self.shap_analyzer = SHAPAnalyzer()
        self.feature_importance_analyzer = FeatureImportanceAnalyzer()
    
    def get_feature_importance(self, model_name: Optional[str] = None) -> Dict:
        """Get feature importance for models"""
        try:
            if model_name:
                # Get importance for specific model
                if model_name in self.supervised_trainer.models:
                    model = self.supervised_trainer.models[model_name]
                    importance = self.feature_importance_analyzer.calculate_permutation_importance(
                        model, model_name
                    )
                else:
                    raise ValueError(f"Model {model_name} not found")
            else:
                # Get importance for all models
                importance = {}
                for name in self.supervised_trainer.models.keys():
                    model = self.supervised_trainer.models[name]
                    importance[name] = self.feature_importance_analyzer.calculate_permutation_importance(
                        model, name
                    )
            
            return {
                'model_name': model_name or 'all',
                'features': importance,
                'shap_values': None  # Can be added if needed
            }
        except Exception as e:
            logger.error(f"Error getting feature importance: {e}")
            return {
                'model_name': model_name or 'all',
                'features': {},
                'shap_values': None
            }
    
    def retrain_models(
        self,
        model_type: str = 'all',
        force: bool = False
    ):
        """Retrain ML models"""
        logger.info(f"Retraining {model_type} models...")
        
        # Load dataset
        data_path = Path(settings.DATA_PATH) / "merged_dataset.parquet"
        if not data_path.exists():
            logger.error("Dataset not found. Please run data pipeline first.")
            return
        
        df = pd.read_parquet(data_path)
        logger.info(f"Loaded dataset with {len(df)} records")
        
        results = {}
        
        try:
            if model_type in ['supervised', 'all']:
                logger.info("Retraining supervised models...")
                results['supervised'] = self.supervised_trainer.train_all_models(df)
            
            if model_type in ['unsupervised', 'all']:
                logger.info("Retraining unsupervised models...")
                self.unsupervised_trainer.train_all_models(df)
                results['unsupervised'] = {}
            
            # Save performance metrics
            self._save_performance_metrics(results)
            
            logger.info("Model retraining completed")
        except Exception as e:
            logger.error(f"Error retraining models: {e}")
            raise
    
    def _save_performance_metrics(self, results: Dict):
        """Save model performance metrics to database"""
        db = SessionLocal()
        try:
            for model_type, model_results in results.items():
                if model_type == 'supervised':
                    for model_name, metrics in model_results.items():
                        perf = ModelPerformance(
                            timestamp=datetime.now(),
                            model_name=model_name,
                            model_type='supervised',
                            precision=metrics.get('precision', 0.0),
                            recall=metrics.get('recall', 0.0),
                            f1_score=metrics.get('f1_score', 0.0),
                            accuracy=metrics.get('accuracy', 0.0),
                            false_positive_rate=metrics.get('false_positive_rate', 0.0),
                            roc_auc=metrics.get('roc_auc'),
                            pr_auc=metrics.get('pr_auc'),
                            latency_ms=metrics.get('latency_ms', 0.0),
                            memory_usage_mb=0.0,  # Can be measured if needed
                            throughput_packets_per_sec=0.0,  # Can be measured if needed
                            performance_metadata={}
                        )
                        db.add(perf)
            
            db.commit()
        except Exception as e:
            logger.error(f"Error saving performance metrics: {e}")
            db.rollback()
        finally:
            db.close()
    
    def update_online_model(
        self,
        packet_features: Dict,
        label: Optional[str] = None,
        feedback: Optional[bool] = None
    ):
        """Update online learning model with new data"""
        try:
            self.online_learner.update_from_packet(
                'online_detector',
                packet_features,
                label=label,
                feedback=feedback
            )
        except Exception as e:
            logger.error(f"Error updating online model: {e}")

