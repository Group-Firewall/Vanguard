"""Machine learning module for Vanguard NIDS

Structure:
- ml/models/: ML model implementations
  - hybrid.py: Hybrid detection system
  - supervised.py: Supervised ML models (Random Forest, XGBoost)
  - unsupervised.py: Unsupervised models (Isolation Forest, One-Class SVM)
  - signature_detection.py: Rule-based signature detection
  - preprocessing.py: Data preprocessing and feature engineering

- ml/trained_models/: Serialized trained model files (.pkl)
  - preprocessor.pkl
  - supervised_random_forest.pkl
  - unsupervised_isolation_forest.pkl
  - hybrid_detector.pkl

- ml/explainability/: Model explainability tools
  - shap_analysis.py: SHAP value analysis
  - feature_importance.py: Feature importance visualization
"""

