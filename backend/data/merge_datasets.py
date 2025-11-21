"""Merge multiple datasets into a unified format"""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import List, Optional, Dict
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatasetMerger:
    """Merge multiple intrusion detection datasets"""
    
    def __init__(self):
        self.processed_path = Path(settings.PROCESSED_DATA_PATH)
        self.data_path = Path(settings.DATA_PATH)
        self.data_path.mkdir(parents=True, exist_ok=True)
    
    def find_common_features(self, datasets: List[pd.DataFrame]) -> List[str]:
        """Find common features across datasets"""
        if not datasets:
            return []
        
        common_features = set(datasets[0].columns)
        for df in datasets[1:]:
            common_features = common_features.intersection(set(df.columns))
        
        # Remove label column from common features (we'll handle it separately)
        common_features.discard('label')
        return sorted(list(common_features))
    
    def standardize_label(self, label: str) -> str:
        """Standardize label names across datasets"""
        label_lower = str(label).lower()
        
        # Normal labels
        if any(norm in label_lower for norm in ['normal', 'benign', '0', 'no']):
            return 'normal'
        
        # Attack labels
        attack_patterns = {
            'dos': 'dos',
            'ddos': 'dos',
            'denial': 'dos',
            'probe': 'probe',
            'scan': 'probe',
            'r2l': 'r2l',
            'remote': 'r2l',
            'u2r': 'u2r',
            'user': 'u2r',
            'backdoor': 'backdoor',
            'bot': 'bot',
            'fuzzers': 'fuzzers',
            'analysis': 'analysis',
            'shellcode': 'shellcode',
            'worms': 'worms',
            'generic': 'generic',
            'exploits': 'exploits',
            'reconnaissance': 'reconnaissance',
        }
        
        for pattern, standard in attack_patterns.items():
            if pattern in label_lower:
                return standard
        
        return 'unknown'
    
    def merge_datasets(
        self,
        dataset_paths: List[Path],
        output_path: Optional[Path] = None,
        sample_size: Optional[int] = None
    ) -> pd.DataFrame:
        """Merge multiple datasets"""
        logger.info(f"Merging {len(dataset_paths)} datasets...")
        
        datasets = []
        for path in dataset_paths:
            try:
                if path.suffix == '.csv':
                    df = pd.read_csv(path)
                elif path.suffix == '.parquet':
                    df = pd.read_parquet(path)
                else:
                    logger.warning(f"Skipping unsupported file: {path}")
                    continue
                
                # Standardize labels if present
                if 'label' in df.columns:
                    df['label'] = df['label'].apply(self.standardize_label)
                
                # Sample if requested
                if sample_size and len(df) > sample_size:
                    df = df.sample(n=sample_size, random_state=42)
                
                datasets.append(df)
                logger.info(f"Loaded {len(df)} records from {path.name}")
            except Exception as e:
                logger.error(f"Error loading {path}: {e}")
        
        if not datasets:
            raise ValueError("No datasets loaded")
        
        # Find common features
        common_features = self.find_common_features(datasets)
        logger.info(f"Found {len(common_features)} common features")
        
        # Align datasets to common features
        aligned_datasets = []
        for df in datasets:
            # Select common features
            available_features = [f for f in common_features if f in df.columns]
            df_aligned = df[available_features + (['label'] if 'label' in df.columns else [])].copy()
            
            # Fill missing features with 0
            for feature in common_features:
                if feature not in df_aligned.columns:
                    df_aligned[feature] = 0
            
            # Reorder columns
            df_aligned = df_aligned[common_features + (['label'] if 'label' in df.columns else [])]
            aligned_datasets.append(df_aligned)
        
        # Merge datasets
        merged_df = pd.concat(aligned_datasets, ignore_index=True)
        logger.info(f"Merged dataset contains {len(merged_df)} records")
        
        # Save merged dataset
        if output_path is None:
            output_path = self.data_path / "merged_dataset.parquet"
        
        merged_df.to_parquet(output_path, index=False)
        logger.info(f"Saved merged dataset to {output_path}")
        
        # Save metadata
        metadata = {
            'total_records': len(merged_df),
            'features': common_features,
            'feature_count': len(common_features),
            'label_distribution': merged_df['label'].value_counts().to_dict() if 'label' in merged_df.columns else {}
        }
        
        metadata_path = self.data_path / "merged_dataset_metadata.json"
        import json
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return merged_df
    
    def create_synthetic_data(self, n_samples: int = 1000) -> pd.DataFrame:
        """Create synthetic network traffic data for testing"""
        logger.info(f"Creating {n_samples} synthetic samples...")
        
        np.random.seed(42)
        
        # Generate synthetic features
        data = {
            'src_ip': [f"192.168.1.{np.random.randint(1, 255)}" for _ in range(n_samples)],
            'dst_ip': [f"10.0.0.{np.random.randint(1, 255)}" for _ in range(n_samples)],
            'src_port': np.random.randint(1024, 65535, n_samples),
            'dst_port': np.random.choice([80, 443, 22, 53, 3389], n_samples),
            'protocol': np.random.choice(['TCP', 'UDP', 'ICMP'], n_samples),
            'packet_size': np.random.randint(64, 1500, n_samples),
            'duration': np.random.exponential(1.0, n_samples),
            'bytes_sent': np.random.randint(0, 10000, n_samples),
            'bytes_received': np.random.randint(0, 10000, n_samples),
            'packets_sent': np.random.randint(1, 100, n_samples),
            'packets_received': np.random.randint(1, 100, n_samples),
        }
        
        df = pd.DataFrame(data)
        
        # Generate labels (mostly normal, some attacks)
        labels = ['normal'] * int(n_samples * 0.8)
        labels += ['dos'] * int(n_samples * 0.1)
        labels += ['probe'] * int(n_samples * 0.05)
        labels += ['r2l'] * int(n_samples * 0.05)
        np.random.shuffle(labels)
        df['label'] = labels[:n_samples]
        
        return df


def main():
    """Main entry point"""
    merger = DatasetMerger()
    
    # Find all processed datasets
    processed_path = Path(settings.PROCESSED_DATA_PATH)
    dataset_files = list(processed_path.glob("*_transformed.parquet"))
    
    if not dataset_files:
        logger.warning("No processed datasets found. Creating synthetic data for testing...")
        synthetic_df = merger.create_synthetic_data(n_samples=5000)
        synthetic_path = processed_path / "synthetic_transformed.parquet"
        synthetic_df.to_parquet(synthetic_path, index=False)
        dataset_files = [synthetic_path]
    
    # Merge datasets
    if dataset_files:
        merger.merge_datasets(dataset_files)
    else:
        logger.error("No datasets to merge")


if __name__ == "__main__":
    main()

