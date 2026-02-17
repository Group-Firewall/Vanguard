"""Main FastAPI application"""
import sys
import os

# Add project root to sys.path preventing ImportErrors
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import routes, websocket
from app.database import init_db

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Machine Learning Based Network Intrusion Detection System"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from app.api import auth, firewall
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(firewall.router, prefix="/api/firewall", tags=["firewall"])
app.include_router(routes.router, prefix="/api", tags=["api"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])

# Include ML routes
from app.api import ml_routes
app.include_router(ml_routes.router, prefix="/api", tags=["ml"])

# Include stats routes
from app.api import stats_routes
app.include_router(stats_routes.router, prefix="/api", tags=["stats"])


@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    # Initialize database
    init_db()
    print(f"{settings.APP_NAME} v{settings.VERSION} started successfully!")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("Shutting down Vanguard NIDS...")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

