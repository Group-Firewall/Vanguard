"""Data collection script for network intrusion datasets"""
import os
import requests
import zipfile
import pandas as pd
from pathlib import Path
from typing import Optional
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatasetCollector:
    """Collect and download network intrusion datasets"""
    
    def __init__(self):
        self.data_path = Path(settings.RAW_DATA_PATH)
        self.data_path.mkdir(parents=True, exist_ok=True)
    
    def download_file(self, url: str, filename: str) -> Path:
        """Download a file from URL"""
        filepath = self.data_path / filename
        
        if filepath.exists():
            logger.info(f"File {filename} already exists, skipping download")
            return filepath
        
        logger.info(f"Downloading {filename} from {url}...")
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info(f"Downloaded {filename}")
        return filepath
    
    def extract_zip(self, zip_path: Path, extract_to: Optional[Path] = None):
        """Extract zip file"""
        if extract_to is None:
            extract_to = self.data_path
        
        logger.info(f"Extracting {zip_path.name}...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        logger.info(f"Extracted to {extract_to}")
    
    def collect_unsw_nb15(self):
        """Collect UNSW-NB15 dataset"""
        logger.info("Collecting UNSW-NB15 dataset...")
        # Note: In production, you would download from the official source
        # For now, we'll create a placeholder structure
        unsw_path = self.data_path / "unsw-nb15"
        unsw_path.mkdir(exist_ok=True)
        
        logger.info("UNSW-NB15 dataset structure created")
        logger.warning("Please download UNSW-NB15 dataset manually from: https://www.unsw.adfa.edu.au/unsw-canberra-cyber/cybersecurity/ADFA-NB15-Datasets/")
        return unsw_path
    
    def collect_cicids2017(self):
        """Collect CICIDS2017 dataset"""
        logger.info("Collecting CICIDS2017 dataset...")
        cicids_path = self.data_path / "cicids2017"
        cicids_path.mkdir(exist_ok=True)
        
        logger.info("CICIDS2017 dataset structure created")
        logger.warning("Please download CICIDS2017 dataset manually from: https://www.unb.ca/cic/datasets/ids-2017.html")
        return cicids_path
    
    def collect_nsl_kdd(self):
        """Collect NSL-KDD dataset"""
        logger.info("Collecting NSL-KDD dataset...")
        nsl_kdd_path = self.data_path / "nsl-kdd"
        nsl_kdd_path.mkdir(exist_ok=True)
        
        # NSL-KDD is publicly available
        try:
            url = "https://www.unb.ca/cic/datasets/nsl.html"
            logger.info(f"NSL-KDD dataset info: {url}")
            logger.warning("Please download NSL-KDD dataset manually")
        except Exception as e:
            logger.error(f"Error collecting NSL-KDD: {e}")
        
        return nsl_kdd_path
    
    def collect_all(self):
        """Collect all datasets"""
        logger.info("Starting dataset collection...")
        
        datasets = {
            "unsw-nb15": self.collect_unsw_nb15(),
            "cicids2017": self.collect_cicids2017(),
            "nsl-kdd": self.collect_nsl_kdd()
        }
        
        logger.info("Dataset collection completed!")
        return datasets


def main():
    """Main entry point"""
    collector = DatasetCollector()
    collector.collect_all()


if __name__ == "__main__":
    main()

