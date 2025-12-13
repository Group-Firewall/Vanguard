#!/bin/bash
# Setup script for Vanguard NIDS

echo "Setting up Vanguard NIDS..."

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Initialization of the database
echo "Initializing database..."
cd backend
python -m app.database

# Create data directories
echo "Creating data directories..."
mkdir -p data/raw data/processed data/datasets
mkdir -p models/supervised models/unsupervised models/hybrid

# Generate synthetic data if no datasets available
echo "Generating synthetic test data..."
python -m data.merge_datasets

# Train initial models
echo "Training initial models..."
python -m ml.models.supervised
python -m ml.models.unsupervised

cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install

cd ..

echo "Setup complete!"
echo ""
echo "To start the backend:"
echo "  cd backend && uvicorn app.main:app --reload"
echo ""
echo "To start the frontend:"
echo "  cd frontend && npm run dev"
# Run instructions after setup
