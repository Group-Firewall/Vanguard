@echo off
REM Start Vanguard NIDS Backend Server

echo Starting Vanguard NIDS Backend...

REM Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo Virtual environment activated
) else (
    echo Warning: Virtual environment not found. Installing dependencies globally...
    pip install -r requirements.txt
)

REM Navigate to backend directory
cd backend

REM Check if uvicorn is available
python -c "import uvicorn" 2>nul
if errorlevel 1 (
    echo Installing uvicorn...
    pip install uvicorn[standard]
)

REM Start the server
echo.
echo Starting FastAPI server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause

