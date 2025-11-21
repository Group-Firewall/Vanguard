"""Script to save the hybrid detection engine as a pickle file"""
import pickle
from pathlib import Path
from ml.models.hybrid import HybridDetectionEngine
from app.config import settings

def save_hybrid_model():
    """Save the hybrid detection engine"""
    print("Initializing hybrid detection engine...")
    engine = HybridDetectionEngine()
    
    print("Loading models...")
    engine.load_models()
    
    # Save the engine
    model_path = Path(settings.HYBRID_MODEL_PATH) / "hybrid.pkl"
    model_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"Saving hybrid model to {model_path}...")
    with open(model_path, 'wb') as f:
        pickle.dump(engine, f)
    
    print(f"✓ Hybrid model saved successfully to {model_path}")
    print(f"  - Supervised models: {len(engine.supervised_trainer.models)}")
    print(f"  - Unsupervised models: {len(engine.unsupervised_trainer.models)}")
    print(f"  - Signature engine: {engine.signature_engine is not None}")

if __name__ == "__main__":
    save_hybrid_model()

