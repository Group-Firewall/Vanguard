@echo off
REM Setup script for Vanguard NIDS (Windows)

echo Setting up Vanguard NIDS...

REM Create virtual environment
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install Python dependencies
echo Installing Python dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

REM Initialize database
echo Initializing database...
cd backend
python -m app.database

REM Create data directories
echo Creating data directories...
if not exist "data\raw" mkdir data\raw
if not exist "data\processed" mkdir data\processed
if not exist "data\datasets" mkdir data\datasets
if not exist "models\supervised" mkdir models\supervised
if not exist "models\unsupervised" mkdir models\unsupervised
if not exist "models\hybrid" mkdir models\hybrid

REM Generate synthetic data if no datasets available
echo Generating synthetic test data...
python -m data.merge_datasets

REM Train initial models
echo Training initial models...
python -m ml.models.supervised
python -m ml.models.unsupervised

cd ..

REM Install frontend dependencies
echo Installing frontend dependencies...
cd frontend
if not exist "node_modules" (
    call npm install
) else (
    echo node_modules already exists, skipping npm install
)

cd ..

echo.
echo Setup complete!
echo.
echo To start the backend:
echo   cd backend ^&^& uvicorn app.main:app --reload
echo.
echo To start the frontend:
echo   cd frontend ^&^& npm run dev

pause

