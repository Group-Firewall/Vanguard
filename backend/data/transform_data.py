"""Feature extraction and transformation pipeline"""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from app.config import settings
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FeatureExtractor:
    """Extract features from network packets"""
    
    def __init__(self):
        self.feature_names = []
    
    def extract_basic_features(self, packet_data: Dict) -> Dict:
        """Extract basic packet features"""
        features = {}
        
        # IP layer features
        if 'src_ip' in packet_data:
            features['src_ip'] = packet_data['src_ip']
        if 'dst_ip' in packet_data:
            features['dst_ip'] = packet_data['dst_ip']
        if 'protocol' in packet_data:
            features['protocol'] = packet_data['protocol']
        if 'packet_size' in packet_data:
            features['packet_size'] = packet_data['packet_size']
        
        # Port features
        if 'src_port' in packet_data:
            features['src_port'] = packet_data['src_port']
        if 'dst_port' in packet_data:
            features['dst_port'] = packet_data['dst_port']
        
        # TCP/UDP features
        if 'tcp_flags' in packet_data:
            features['tcp_flags'] = packet_data['tcp_flags']
        if 'tcp_window' in packet_data:
            features['tcp_window'] = packet_data['tcp_window']
        
        return features
    
    def extract_statistical_features(self, packet_window: List[Dict]) -> Dict:
        """Extract statistical features from packet window"""
        if not packet_window:
            return {}
        
        sizes = [p.get('packet_size', 0) for p in packet_window]
        ports = [p.get('dst_port', 0) for p in packet_window if p.get('dst_port')]
        
        features = {
            'mean_packet_size': np.mean(sizes) if sizes else 0,
            'std_packet_size': np.std(sizes) if sizes else 0,
            'min_packet_size': np.min(sizes) if sizes else 0,
            'max_packet_size': np.max(sizes) if sizes else 0,
            'packet_count': len(packet_window),
            'unique_dst_ports': len(set(ports)) if ports else 0,
        }
        
        return features
    
    def extract_flow_features(self, flow_data: List[Dict]) -> Dict:
        """Extract flow-based features"""
        if not flow_data:
            return {}
        
        features = {
            'flow_duration': 0,
            'total_packets': len(flow_data),
            'total_bytes': sum(p.get('packet_size', 0) for p in flow_data),
            'packets_per_second': 0,
            'bytes_per_second': 0,
        }
        
        if len(flow_data) > 1:
            timestamps = [pd.to_datetime(p.get('timestamp', 0)) for p in flow_data if 'timestamp' in p]
            if timestamps:
                duration = (max(timestamps) - min(timestamps)).total_seconds()
                if duration > 0:
                    features['flow_duration'] = duration
                    features['packets_per_second'] = len(flow_data) / duration
                    features['bytes_per_second'] = features['total_bytes'] / duration
        
        return features


class DataTransformer:
    """Transform raw data into ML-ready format"""
    
    def __init__(self):
        self.extractor = FeatureExtractor()
        self.processed_path = Path(settings.PROCESSED_DATA_PATH)
        self.processed_path.mkdir(parents=True, exist_ok=True)
    
    def normalize_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize numerical features"""
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        
        df_normalized = df.copy()
        
        # Encode categorical features
        label_encoders = {}
        categorical_cols = ['protocol', 'src_ip', 'dst_ip']
        
        for col in categorical_cols:
            if col in df_normalized.columns:
                le = LabelEncoder()
                df_normalized[col] = le.fit_transform(df_normalized[col].astype(str))
                label_encoders[col] = le
        
        # Normalize numerical features
        numerical_cols = df_normalized.select_dtypes(include=[np.number]).columns.tolist()
        if 'label' in numerical_cols:
            numerical_cols.remove('label')
        
        scaler = StandardScaler()
        if numerical_cols:
            df_normalized[numerical_cols] = scaler.fit_transform(df_normalized[numerical_cols])
        
        return df_normalized, scaler, label_encoders
    
    def transform_dataset(self, input_path: Path, output_path: Optional[Path] = None) -> pd.DataFrame:
        """Transform a dataset file"""
        logger.info(f"Transforming dataset: {input_path}")
        
        # Load data
        if input_path.suffix == '.csv':
            df = pd.read_csv(input_path)
        elif input_path.suffix == '.parquet':
            df = pd.read_parquet(input_path)
        else:
            raise ValueError(f"Unsupported file format: {input_path.suffix}")
        
        logger.info(f"Loaded {len(df)} records")
        
        # Normalize features
        df_normalized, scaler, encoders = self.normalize_features(df)
        
        # Save transformed data
        if output_path is None:
            output_path = self.processed_path / f"{input_path.stem}_transformed.parquet"
        
        df_normalized.to_parquet(output_path, index=False)
        logger.info(f"Saved transformed data to {output_path}")
        
        # Save preprocessors
        preprocessor_path = self.processed_path / f"{input_path.stem}_preprocessors.json"
        preprocessors = {
            'scaler_mean': scaler.mean_.tolist() if hasattr(scaler, 'mean_') else [],
            'scaler_scale': scaler.scale_.tolist() if hasattr(scaler, 'scale_') else [],
        }
        with open(preprocessor_path, 'w') as f:
            json.dump(preprocessors, f)
        
        return df_normalized
    
    def create_feature_metadata(self, df: pd.DataFrame) -> Dict:
        """Create metadata for features"""
        metadata = {
            'features': [],
            'description': {},
            'label_types': {}
        }
        
        for col in df.columns:
            if col != 'label':
                feature_info = {
                    'name': col,
                    'type': str(df[col].dtype),
                    'min': float(df[col].min()) if pd.api.types.is_numeric_dtype(df[col]) else None,
                    'max': float(df[col].max()) if pd.api.types.is_numeric_dtype(df[col]) else None,
                    'mean': float(df[col].mean()) if pd.api.types.is_numeric_dtype(df[col]) else None,
                    'null_count': int(df[col].isnull().sum())
                }
                metadata['features'].append(feature_info)
                metadata['description'][col] = f"Feature: {col}"
        
        if 'label' in df.columns:
            unique_labels = df['label'].unique().tolist()
            metadata['label_types'] = {
                'unique_values': unique_labels,
                'count': len(unique_labels)
            }
        
        return metadata


def main():
    """Main entry point"""
    transformer = DataTransformer()
    
    # Transform datasets
    raw_path = Path(settings.RAW_DATA_PATH)
    for dataset_file in raw_path.rglob("*.csv"):
        try:
            transformer.transform_dataset(dataset_file)
        except Exception as e:
            logger.error(f"Error transforming {dataset_file}: {e}")


if __name__ == "__main__":
    main()

