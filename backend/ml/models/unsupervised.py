"""Unsupervised learning models for zero-day attack detection"""
import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Autoencoder(nn.Module):
    """Autoencoder for anomaly detection"""
    
    def __init__(self, input_dim: int, encoding_dim: int = 32):
        super(Autoencoder, self).__init__()
        
        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, encoding_dim),
            nn.ReLU()
        )
        
        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(encoding_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 128),
            nn.ReLU(),
            nn.Linear(128, input_dim),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded


class UnsupervisedModelTrainer:
    """Train and manage unsupervised learning models"""
    
    def __init__(self, model_path: Optional[Path] = None):
        if model_path is None:
            try:
                from app.config import settings
            except ImportError:
                import sys
                from pathlib import Path as P
                sys.path.insert(0, str(P(__file__).parent.parent.parent))
                from app.config import settings
            model_path = Path(settings.UNSUPERVISED_MODEL_PATH)
        self.model_path = model_path
        self.model_path.mkdir(parents=True, exist_ok=True)
        self.models = {}
        self.scalers = {}
        self.feature_names = []
    
    def prepare_data(self, df: pd.DataFrame, label_col: Optional[str] = 'label') -> np.ndarray:
        """Prepare data for training (use only normal samples)"""
        # Select numerical features
        X = df.select_dtypes(include=[np.number])
        
        # If label column exists, filter to normal samples only
        if label_col and label_col in df.columns:
            normal_mask = df[label_col].str.lower().isin(['normal', 'benign', '0'])
            X = X[normal_mask.values]
            logger.info(f"Using {len(X)} normal samples for training")
        
        # Store feature names
        self.feature_names = X.columns.tolist()
        
        return X.values
    
    def train_isolation_forest(
        self,
        X: np.ndarray,
        contamination: float = 0.1,
        n_estimators: int = 100,
        random_state: int = 42
    ) -> IsolationForest:
        """Train Isolation Forest model"""
        logger.info("Training Isolation Forest model...")
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        model = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=-1,
            verbose=1
        )
        
        model.fit(X_scaled)
        self.models['isolation_forest'] = model
        self.scalers['isolation_forest'] = scaler
        
        # Save model
        model_file = self.model_path / "isolation_forest.pkl"
        with open(model_file, 'wb') as f:
            pickle.dump({'model': model, 'scaler': scaler}, f)
        
        logger.info(f"Isolation Forest model saved to {model_file}")
        return model
    
    def train_one_class_svm(
        self,
        X: np.ndarray,
        nu: float = 0.1,
        kernel: str = 'rbf',
        gamma: str = 'scale'
    ) -> OneClassSVM:
        """Train One-Class SVM model"""
        logger.info("Training One-Class SVM model...")
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # For large datasets, sample
        if len(X_scaled) > 10000:
            logger.warning("Large dataset detected. Sampling for efficiency.")
            indices = np.random.choice(len(X_scaled), size=10000, replace=False)
            X_scaled = X_scaled[indices]
        
        model = OneClassSVM(
            nu=nu,
            kernel=kernel,
            gamma=gamma,
            verbose=True
        )
        
        model.fit(X_scaled)
        self.models['one_class_svm'] = model
        self.scalers['one_class_svm'] = scaler
        
        # Save model
        model_file = self.model_path / "one_class_svm.pkl"
        with open(model_file, 'wb') as f:
            pickle.dump({'model': model, 'scaler': scaler}, f)
        
        logger.info(f"One-Class SVM model saved to {model_file}")
        return model
    
    def train_autoencoder(
        self,
        X: np.ndarray,
        encoding_dim: int = 32,
        epochs: int = 50,
        batch_size: int = 32,
        learning_rate: float = 0.001,
        device: str = 'cpu'
    ) -> Autoencoder:
        """Train Autoencoder model"""
        logger.info("Training Autoencoder model...")
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Convert to tensors
        X_tensor = torch.FloatTensor(X_scaled)
        dataset = TensorDataset(X_tensor)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
        
        # Initialize model
        input_dim = X_scaled.shape[1]
        model = Autoencoder(input_dim=input_dim, encoding_dim=encoding_dim)
        model = model.to(device)
        
        # Loss and optimizer
        criterion = nn.MSELoss()
        optimizer = optim.Adam(model.parameters(), lr=learning_rate)
        
        # Training loop
        model.train()
        for epoch in range(epochs):
            total_loss = 0
            for batch in dataloader:
                x = batch[0].to(device)
                
                optimizer.zero_grad()
                reconstructed = model(x)
                loss = criterion(reconstructed, x)
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
            
            if (epoch + 1) % 10 == 0:
                logger.info(f"Epoch [{epoch+1}/{epochs}], Loss: {total_loss/len(dataloader):.4f}")
        
        self.models['autoencoder'] = model
        self.scalers['autoencoder'] = scaler
        
        # Save model
        model_file = self.model_path / "autoencoder.pkl"
        with open(model_file, 'wb') as f:
            pickle.dump({'model': model, 'scaler': scaler, 'encoding_dim': encoding_dim}, f)
        
        logger.info(f"Autoencoder model saved to {model_file}")
        return model
    
    def train_all_models(
        self,
        df: pd.DataFrame,
        label_col: Optional[str] = 'label'
    ) -> Dict[str, Dict]:
        """Train all unsupervised models"""
        logger.info("Training all unsupervised models...")
        
        # Prepare data (normal samples only)
        X = self.prepare_data(df, label_col)
        
        # Train models
        self.train_isolation_forest(X)
        self.train_one_class_svm(X)
        
        # Train autoencoder if GPU available or small dataset
        try:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
            logger.info(f"Using device: {device}")
            self.train_autoencoder(X, device=device)
        except Exception as e:
            logger.warning(f"Could not train autoencoder: {e}")
        
        return {}
    
    def predict_anomaly(
        self,
        model_name: str,
        X: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Predict anomalies with a model"""
        if model_name not in self.models:
            self.load_model(model_name)
        
        model = self.models[model_name]
        scaler = self.scalers.get(model_name)
        
        # Scale features
        if scaler:
            X_scaled = scaler.transform(X)
        else:
            X_scaled = X
        
        # Predict
        if model_name == 'autoencoder':
            model.eval()
            with torch.no_grad():
                X_tensor = torch.FloatTensor(X_scaled)
                reconstructed = model(X_tensor)
                # Anomaly score is reconstruction error
                errors = torch.mean((X_tensor - reconstructed) ** 2, dim=1).numpy()
                predictions = (errors > np.percentile(errors, 90)).astype(int)  # Top 10% as anomalies
                scores = errors
        elif model_name in ['isolation_forest', 'one_class_svm']:
            predictions = model.predict(X_scaled)
            scores = model.score_samples(X_scaled)
            # Convert -1/1 to 0/1
            predictions = (predictions == -1).astype(int)
        else:
            raise ValueError(f"Unknown model: {model_name}")
        
        return predictions, scores
    
    def load_model(self, model_name: str):
        """Load a saved model"""
        model_file = self.model_path / f"{model_name}.pkl"
        if not model_file.exists():
            raise FileNotFoundError(f"Model {model_name} not found at {model_file}")
        
        with open(model_file, 'rb') as f:
            data = pickle.load(f)
        
        if isinstance(data, dict):
            self.models[model_name] = data['model']
            if 'scaler' in data:
                self.scalers[model_name] = data['scaler']
        else:
            self.models[model_name] = data


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
    trainer = UnsupervisedModelTrainer()
    trainer.train_all_models(df)


if __name__ == "__main__":
    main()

