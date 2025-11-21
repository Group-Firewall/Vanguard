"""Generate evaluation reports with plots and tables"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import json
from typing import Dict
import logging

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (12, 8)


class ReportGenerator:
    """Generate evaluation reports"""
    
    def __init__(self):
        self.reports_path = Path(settings.DATA_PATH) / "reports"
        self.reports_path.mkdir(parents=True, exist_ok=True)
    
    def load_results(self) -> Dict:
        """Load evaluation results"""
        results_path = Path(settings.DATA_PATH) / "evaluation_results.json"
        
        if not results_path.exists():
            raise FileNotFoundError(f"Results not found at {results_path}")
        
        with open(results_path, 'r') as f:
            results = json.load(f)
        
        return results
    
    def generate_metrics_table(self, results: Dict) -> pd.DataFrame:
        """Generate metrics comparison table"""
        metrics_data = []
        
        for scenario_name, scenario_results in results.items():
            if scenario_name == 'timestamp':
                continue
            
            metrics_data.append({
                'Scenario': scenario_results['scenario'],
                'Accuracy': f"{scenario_results['accuracy']:.4f}",
                'Precision': f"{scenario_results['precision']:.4f}",
                'Recall': f"{scenario_results['recall']:.4f}",
                'F1-Score': f"{scenario_results['f1_score']:.4f}",
                'FPR': f"{scenario_results['false_positive_rate']:.4f}",
                'Latency (ms)': f"{scenario_results['avg_latency_ms']:.2f}",
                'TP': scenario_results['true_positives'],
                'FP': scenario_results['false_positives'],
                'TN': scenario_results['true_negatives'],
                'FN': scenario_results['false_negatives']
            })
        
        df = pd.DataFrame(metrics_data)
        return df
    
    def plot_metrics_comparison(self, results: Dict):
        """Plot metrics comparison across scenarios"""
        scenarios = []
        metrics = {
            'Accuracy': [],
            'Precision': [],
            'Recall': [],
            'F1-Score': [],
            'FPR': []
        }
        
        for scenario_name, scenario_results in results.items():
            if scenario_name == 'timestamp':
                continue
            
            scenarios.append(scenario_results['scenario'])
            metrics['Accuracy'].append(scenario_results['accuracy'])
            metrics['Precision'].append(scenario_results['precision'])
            metrics['Recall'].append(scenario_results['recall'])
            metrics['F1-Score'].append(scenario_results['f1_score'])
            metrics['FPR'].append(scenario_results['false_positive_rate'])
        
        # Create subplots
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        axes = axes.flatten()
        
        metric_names = ['Accuracy', 'Precision', 'Recall', 'F1-Score', 'FPR']
        for idx, metric_name in enumerate(metric_names):
            ax = axes[idx]
            ax.bar(scenarios, metrics[metric_name], color=['#3b82f6', '#10b981', '#f59e0b'])
            ax.set_title(f'{metric_name} by Scenario', fontsize=14, fontweight='bold')
            ax.set_ylabel(metric_name)
            ax.set_ylim([0, 1])
            ax.grid(axis='y', alpha=0.3)
            
            # Add value labels
            for i, v in enumerate(metrics[metric_name]):
                ax.text(i, v + 0.01, f'{v:.3f}', ha='center', va='bottom')
        
        # Confusion matrix heatmap
        ax = axes[5]
        scenario_results = list(results.values())[0]  # Use first scenario
        if isinstance(scenario_results, dict) and 'scenario' in scenario_results:
            cm_data = [
                [scenario_results['true_negatives'], scenario_results['false_positives']],
                [scenario_results['false_negatives'], scenario_results['true_positives']]
            ]
            sns.heatmap(cm_data, annot=True, fmt='d', cmap='Blues', ax=ax,
                       xticklabels=['Normal', 'Attack'],
                       yticklabels=['Normal', 'Attack'])
            ax.set_title('Confusion Matrix (Scenario 1)', fontsize=14, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(self.reports_path / 'metrics_comparison.png', dpi=300, bbox_inches='tight')
        logger.info(f"Saved metrics comparison plot to {self.reports_path / 'metrics_comparison.png'}")
        plt.close()
    
    def plot_latency_distribution(self, results: Dict):
        """Plot latency distribution"""
        fig, axes = plt.subplots(1, 3, figsize=(18, 6))
        
        scenario_idx = 0
        for scenario_name, scenario_results in results.items():
            if scenario_name == 'timestamp':
                continue
            
            if 'latencies' in scenario_results and scenario_results['latencies']:
                ax = axes[scenario_idx]
                latencies = scenario_results['latencies']
                
                ax.hist(latencies, bins=50, color='#3b82f6', alpha=0.7, edgecolor='black')
                ax.axvline(np.mean(latencies), color='red', linestyle='--', 
                          label=f'Mean: {np.mean(latencies):.2f} ms')
                ax.set_title(f"Latency Distribution - {scenario_results['scenario']}", 
                           fontsize=12, fontweight='bold')
                ax.set_xlabel('Latency (ms)')
                ax.set_ylabel('Frequency')
                ax.legend()
                ax.grid(axis='y', alpha=0.3)
                
                scenario_idx += 1
        
        plt.tight_layout()
        plt.savefig(self.reports_path / 'latency_distribution.png', dpi=300, bbox_inches='tight')
        logger.info(f"Saved latency distribution plot to {self.reports_path / 'latency_distribution.png'}")
        plt.close()
    
    def plot_roc_curves(self, results: Dict):
        """Plot ROC curves (if available)"""
        # This would require prediction probabilities
        # For now, create a placeholder
        logger.info("ROC curve plotting requires prediction probabilities")
    
    def generate_summary_report(self, results: Dict, metrics_df: pd.DataFrame):
        """Generate text summary report"""
        report_path = self.reports_path / 'evaluation_summary.txt'
        
        with open(report_path, 'w') as f:
            f.write("="*80 + "\n")
            f.write("VANGUARD NIDS - EVALUATION SUMMARY REPORT\n")
            f.write("="*80 + "\n\n")
            f.write(f"Generated: {results.get('timestamp', 'Unknown')}\n\n")
            
            f.write("METRICS COMPARISON TABLE\n")
            f.write("-"*80 + "\n")
            f.write(metrics_df.to_string(index=False))
            f.write("\n\n")
            
            f.write("DETAILED RESULTS BY SCENARIO\n")
            f.write("-"*80 + "\n\n")
            
            for scenario_name, scenario_results in results.items():
                if scenario_name == 'timestamp':
                    continue
                
                f.write(f"Scenario: {scenario_results['scenario']}\n")
                f.write(f"  Total Samples: {scenario_results['total_samples']}\n")
                f.write(f"  True Positives: {scenario_results['true_positives']}\n")
                f.write(f"  False Positives: {scenario_results['false_positives']}\n")
                f.write(f"  True Negatives: {scenario_results['true_negatives']}\n")
                f.write(f"  False Negatives: {scenario_results['false_negatives']}\n")
                f.write(f"  Accuracy: {scenario_results['accuracy']:.4f}\n")
                f.write(f"  Precision: {scenario_results['precision']:.4f}\n")
                f.write(f"  Recall: {scenario_results['recall']:.4f}\n")
                f.write(f"  F1-Score: {scenario_results['f1_score']:.4f}\n")
                f.write(f"  False Positive Rate: {scenario_results['false_positive_rate']:.4f}\n")
                f.write(f"  Average Latency: {scenario_results['avg_latency_ms']:.2f} ms\n")
                f.write("\n")
            
            f.write("="*80 + "\n")
        
        logger.info(f"Saved summary report to {report_path}")
    
    def generate_all_reports(self):
        """Generate all reports"""
        logger.info("Generating evaluation reports...")
        
        # Load results
        results = self.load_results()
        
        # Generate metrics table
        metrics_df = self.generate_metrics_table(results)
        
        # Save table as CSV
        table_path = self.reports_path / 'metrics_table.csv'
        metrics_df.to_csv(table_path, index=False)
        logger.info(f"Saved metrics table to {table_path}")
        
        # Generate plots
        self.plot_metrics_comparison(results)
        self.plot_latency_distribution(results)
        
        # Generate summary report
        self.generate_summary_report(results, metrics_df)
        
        logger.info(f"\nAll reports generated in {self.reports_path}")


def main():
    """Main entry point"""
    generator = ReportGenerator()
    generator.generate_all_reports()


if __name__ == "__main__":
    main()

