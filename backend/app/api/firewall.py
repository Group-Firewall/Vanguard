from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import datetime

from app.database import get_db
from app.security import get_current_user
from app.models import Alert

router = APIRouter()

# Global blocklist (In-memory for now, could be persisted)
blocked_ips = set()

@router.post("/block")
async def block_ip(
    ip_data: Dict[str, str],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Block a source IP address"""
    ip = ip_data.get('ip')
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    
    blocked_ips.add(ip)
    
    # Log the action (Optional: create specialized firewall logs)
    print(f"Admin {current_user.username} blocked IP: {ip}")
    
    return {"message": f"IP {ip} has been blocked successfully", "status": "blocked"}

@router.post("/unblock")
async def unblock_ip(
    ip_data: Dict[str, str],
    current_user = Depends(get_current_user)
):
    """Unblock a source IP address"""
    ip = ip_data.get('ip')
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    
    if ip in blocked_ips:
        blocked_ips.remove(ip)
        return {"message": f"IP {ip} has been unblocked", "status": "active"}
    
    return {"message": f"IP {ip} was not in blocklist", "status": "active"}

@router.get("/list")
async def list_blocked_ips(current_user = Depends(get_current_user)):
    """List all blocked IP addresses"""
    return {"blocked_ips": list(blocked_ips)}
