"""Setup script for Vanguard NIDS"""
from setuptools import setup, find_packages

setup(
    name="vanguard-nids",
    version="1.0.0",
    description="Machine Learning Based Network Intrusion Detection System",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "fastapi>=0.104.1",
        "uvicorn[standard]>=0.24.0",
        "pydantic>=2.5.0",
        "pydantic-settings>=2.1.0",
        "sqlalchemy>=2.0.23",
        "scikit-learn>=1.3.2",
        "xgboost>=2.0.3",
        "lightgbm>=4.1.0",
        "torch>=2.1.1",
        "numpy>=1.24.3",
        "pandas>=2.1.3",
        "scapy>=2.5.0",
        "shap>=0.43.0",
        "river>=0.21.1",
        "matplotlib>=3.8.2",
        "seaborn>=0.13.0",
        "plotly>=5.18.0",
    ],
) #script for Vangaurd

