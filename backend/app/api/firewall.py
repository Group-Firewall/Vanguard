from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import datetime

from app.database import get_db
from app.security import get_current_user, get_current_active_user, PermissionChecker
from app.models import Alert, User

router = APIRouter()

# Global blocklist (In-memory for now, could be persisted)
blocked_ips = set()
whitelisted_ips = set()

@router.post("/block")
async def block_ip(
    ip_data: Dict[str, str],
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("write"))
):
    """Block a source IP address (requires write permission)"""
    ip = ip_data.get('ip')
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    
    blocked_ips.add(ip)
    # Remove from whitelist if present
    whitelisted_ips.discard(ip)
    
    # Log the action
    print(f"User {current_user.username} blocked IP: {ip}")
    
    return {"message": f"IP {ip} has been blocked successfully", "status": "blocked"}

@router.post("/unblock")
async def unblock_ip(
    ip_data: Dict[str, str],
    current_user: User = Depends(PermissionChecker("write"))
):
    """Unblock a source IP address (requires write permission)"""
    ip = ip_data.get('ip')
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    
    if ip in blocked_ips:
        blocked_ips.remove(ip)
        return {"message": f"IP {ip} has been unblocked", "status": "active"}
    
    return {"message": f"IP {ip} was not in blocklist", "status": "active"}

@router.post("/whitelist")
async def whitelist_ip(
    ip_data: Dict[str, str],
    current_user: User = Depends(PermissionChecker("write"))
):
    """Add IP to whitelist (requires write permission)"""
    ip = ip_data.get('ip')
    if not ip:
        raise HTTPException(status_code=400, detail="IP address required")
    
    whitelisted_ips.add(ip)
    # Remove from blocklist if present
    blocked_ips.discard(ip)
    
    print(f"User {current_user.username} whitelisted IP: {ip}")
    
    return {"message": f"IP {ip} has been whitelisted", "status": "whitelisted"}

@router.get("/list")
async def list_blocked_ips(current_user: User = Depends(get_current_active_user)):
    """List all blocked IP addresses (requires authentication)"""
    return {
        "blocked_ips": list(blocked_ips),
        "whitelisted_ips": list(whitelisted_ips)
    }

@router.get("/check/{ip}")
async def check_ip_status(
    ip: str,
    current_user: User = Depends(get_current_active_user)
):
    """Check if an IP is blocked, whitelisted, or neutral"""
    if ip in blocked_ips:
        return {"ip": ip, "status": "blocked"}
    elif ip in whitelisted_ips:
        return {"ip": ip, "status": "whitelisted"}
    else:
        return {"ip": ip, "status": "neutral"}
