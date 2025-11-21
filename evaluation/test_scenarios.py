"""Test scenarios for NIDS evaluation"""
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime
import logging

from app.config import settings
from ml.models.supervised import SupervisedModelTrainer
from ml.models.unsupervised import UnsupervisedModelTrainer
from ml.models.hybrid import HybridDetectionEngine
from app.services.detection_engine import DetectionEngine
from app.services.feature_extraction import FeatureExtractionService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestScenarioRunner:
    """Run test scenarios for NIDS evaluation"""
    
    def __init__(self):
        self.detection_engine = DetectionEngine()
        self.feature_extractor = FeatureExtractionService()
        self.results = {}
    
    def scenario_1_normal_and_known_attacks(self, test_data: pd.DataFrame) -> Dict:
        """Scenario 1: Normal + Known Attacks"""
        logger.info("Running Scenario 1: Normal + Known Attacks")
        
        results = {
            'scenario': 'Normal + Known Attacks',
            'total_samples': len(test_data),
            'true_positives': 0,
            'false_positives': 0,
            'true_negatives': 0,
            'false_negatives': 0,
            'predictions': [],
            'latencies': []
        }
        
        for idx, row in test_data.iterrows():
            try:
                # Extract features
                packet_dict = {
                    'src_ip': str(row.get('src_ip', '192.168.1.1')),
                    'dst_ip': str(row.get('dst_ip', '10.0.0.1')),
                    'src_port': int(row.get('src_port', 12345)),
                    'dst_port': int(row.get('dst_port', 80)),
                    'protocol': str(row.get('protocol', 'TCP')),
                    'packet_size': int(row.get('packet_size', 64)),
                    'timestamp': datetime.now()
                }
                
                # Run detection
                import time
                start_time = time.time()
                detection_result = self.detection_engine.detect_packet(packet_dict)
                latency = (time.time() - start_time) * 1000
                
                # Get ground truth
                label = str(row.get('label', 'normal')).lower()
                is_attack = label not in ['normal', 'benign', '0']
                
                # Compare with ground truth
                predicted_attack = detection_result.get('is_malicious', False)
                
                if is_attack and predicted_attack:
                    results['true_positives'] += 1
                elif not is_attack and predicted_attack:
                    results['false_positives'] += 1
                elif not is_attack and not predicted_attack:
                    results['true_negatives'] += 1
                elif is_attack and not predicted_attack:
                    results['false_negatives'] += 1
                
                results['predictions'].append({
                    'ground_truth': is_attack,
                    'predicted': predicted_attack,
                    'threat_score': detection_result.get('threat_score', 0.0),
                    'severity': detection_result.get('severity', 'low')
                })
                results['latencies'].append(latency)
                
            except Exception as e:
                logger.error(f"Error processing sample {idx}: {e}")
        
        # Calculate metrics
        results['precision'] = results['true_positives'] / max(
            results['true_positives'] + results['false_positives'], 1
        )
        results['recall'] = results['true_positives'] / max(
            results['true_positives'] + results['false_negatives'], 1
        )
        results['f1_score'] = 2 * (results['precision'] * results['recall']) / max(
            results['precision'] + results['recall'], 1e-10
        )
        results['false_positive_rate'] = results['false_positives'] / max(
            results['false_positives'] + results['true_negatives'], 1
        )
        results['accuracy'] = (results['true_positives'] + results['true_negatives']) / max(
            results['total_samples'], 1
        )
        results['avg_latency_ms'] = np.mean(results['latencies']) if results['latencies'] else 0.0
        
        return results
    
    def scenario_2_normal_and_zero_day(self, test_data: pd.DataFrame) -> Dict:
        """Scenario 2: Normal + Zero-Day Attacks"""
        logger.info("Running Scenario 2: Normal + Zero-Day Attacks")
        
        # Filter to only normal samples and unknown attack patterns
        # For zero-day, we'll simulate by using attack samples not seen in training
        normal_data = test_data[test_data['label'].str.lower().isin(['normal', 'benign'])]
        
        # Create synthetic zero-day attacks (anomalous patterns)
        zero_day_samples = self._create_zero_day_samples(len(normal_data) // 10)
        
        # Combine
        combined_data = pd.concat([normal_data, zero_day_samples], ignore_index=True)
        
        # Run same detection as scenario 1
        return self.scenario_1_normal_and_known_attacks(combined_data)
    
    def scenario_3_normal_and_mixed_attacks(self, test_data: pd.DataFrame) -> Dict:
        """Scenario 3: Normal + Mixed Attacks (Known + Zero-Day)"""
        logger.info("Running Scenario 3: Normal + Mixed Attacks")
        
        # Use full test dataset (should contain both known and unknown patterns)
        return self.scenario_1_normal_and_known_attacks(test_data)
    
    def _create_zero_day_samples(self, n_samples: int) -> pd.DataFrame:
        """Create synthetic zero-day attack samples"""
        np.random.seed(42)
        
        data = {
            'src_ip': [f"10.{np.random.randint(0, 255)}.{np.random.randint(0, 255)}.{np.random.randint(1, 255)}" 
                      for _ in range(n_samples)],
            'dst_ip': [f"192.168.{np.random.randint(0, 255)}.{np.random.randint(1, 255)}" 
                      for _ in range(n_samples)],
            'src_port': np.random.randint(49152, 65535, n_samples),  # High ports
            'dst_port': np.random.choice([4444, 31337, 12345, 54321], n_samples),  # Suspicious ports
            'protocol': np.random.choice(['TCP', 'UDP'], n_samples),
            'packet_size': np.random.randint(1500, 2000, n_samples),  # Large packets
            'label': ['zero_day'] * n_samples
        }
        
        return pd.DataFrame(data)
    
    def run_all_scenarios(self, test_data_path: Path) -> Dict:
        """Run all test scenarios"""
        logger.info(f"Loading test data from {test_data_path}")
        
        if test_data_path.suffix == '.csv':
            test_data = pd.read_csv(test_data_path)
        elif test_data_path.suffix == '.parquet':
            test_data = pd.read_parquet(test_data_path)
        else:
            raise ValueError(f"Unsupported file format: {test_data_path.suffix}")
        
        logger.info(f"Loaded {len(test_data)} test samples")
        
        # Sample if too large (for faster testing)
        if len(test_data) > 10000:
            logger.info("Sampling 10000 samples for testing")
            test_data = test_data.sample(n=10000, random_state=42)
        
        # Run scenarios
        results = {
            'scenario_1': self.scenario_1_normal_and_known_attacks(test_data),
            'scenario_2': self.scenario_2_normal_and_zero_day(test_data),
            'scenario_3': self.scenario_3_normal_and_mixed_attacks(test_data),
            'timestamp': datetime.now().isoformat()
        }
        
        return results


def main():
    """Main entry point"""
    runner = TestScenarioRunner()
    
    # Load test data
    test_data_path = Path(settings.DATA_PATH) / "merged_dataset.parquet"
    
    if not test_data_path.exists():
        logger.error(f"Test data not found at {test_data_path}")
        logger.info("Please run data pipeline first")
        return
    
    # Run all scenarios
    results = runner.run_all_scenarios(test_data_path)
    
    # Print results
    logger.info("\n" + "="*60)
    logger.info("EVALUATION RESULTS")
    logger.info("="*60)
    
    for scenario_name, scenario_results in results.items():
        if scenario_name == 'timestamp':
            continue
        
        logger.info(f"\n{scenario_results['scenario']}:")
        logger.info(f"  Accuracy: {scenario_results['accuracy']:.4f}")
        logger.info(f"  Precision: {scenario_results['precision']:.4f}")
        logger.info(f"  Recall: {scenario_results['recall']:.4f}")
        logger.info(f"  F1-Score: {scenario_results['f1_score']:.4f}")
        logger.info(f"  False Positive Rate: {scenario_results['false_positive_rate']:.4f}")
        logger.info(f"  Average Latency: {scenario_results['avg_latency_ms']:.2f} ms")
        logger.info(f"  TP: {scenario_results['true_positives']}, "
                   f"FP: {scenario_results['false_positives']}, "
                   f"TN: {scenario_results['true_negatives']}, "
                   f"FN: {scenario_results['false_negatives']}")
    
    # Save results
    results_path = Path(settings.DATA_PATH) / "evaluation_results.json"
    import json
    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    logger.info(f"\nResults saved to {results_path}")


if __name__ == "__main__":
    main()

