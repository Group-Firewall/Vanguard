from datetime import datetime, timedelta
from typing import Any, Union, Optional, List
from functools import wraps
from jose import jwt, JWTError
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app import models, schemas

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login/access-token")


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    # Truncate to 72 bytes as required by bcrypt
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """Ensure user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Inactive user"
        )
    return current_user


def get_current_admin_user(
    current_user: models.User = Depends(get_current_active_user),
) -> models.User:
    """Require admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


class RoleChecker:
    """
    Role-based access control dependency.
    
    Usage:
        @router.get("/admin-only")
        def admin_route(user: User = Depends(RoleChecker(["admin"]))):
            ...
    """
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(
        self, 
        current_user: models.User = Depends(get_current_active_user)
    ) -> models.User:
        # Use getattr for backwards compatibility with existing users
        user_role = getattr(current_user, 'role', None) or 'analyst'
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(self.allowed_roles)}"
            )
        return current_user


class PermissionChecker:
    """
    Permission-based access control dependency.
    
    Usage:
        @router.delete("/item/{id}")
        def delete_item(user: User = Depends(PermissionChecker("delete"))):
            ...
    """
    # Role-permission mapping
    ROLE_PERMISSIONS = {
        "admin": ["read", "write", "delete", "admin", "settings", "capture"],
        "analyst": ["read", "write", "capture"],
        "viewer": ["read"],
    }

    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def __call__(
        self,
        current_user: models.User = Depends(get_current_active_user)
    ) -> models.User:
        # Use getattr for backwards compatibility with existing users
        user_role = getattr(current_user, 'role', None) or "analyst"
        user_permissions = self.ROLE_PERMISSIONS.get(user_role, [])
        
        if self.required_permission not in user_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{self.required_permission}' required"
            )
        return current_user


# Rate limiting helper (simple in-memory implementation)
from collections import defaultdict
import time

_rate_limit_storage = defaultdict(list)

def rate_limit(max_requests: int = 100, window_seconds: int = 60):
    """
    Rate limiting decorator for routes.
    
    Usage:
        @router.get("/api/data")
        @rate_limit(max_requests=10, window_seconds=60)
        def get_data():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, request: Request = None, **kwargs):
            if request is None:
                # Try to get request from kwargs
                request = kwargs.get('request')
            
            if request:
                client_ip = request.client.host
                current_time = time.time()
                
                # Clean old requests
                _rate_limit_storage[client_ip] = [
                    t for t in _rate_limit_storage[client_ip]
                    if current_time - t < window_seconds
                ]
                
                # Check rate limit
                if len(_rate_limit_storage[client_ip]) >= max_requests:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Rate limit exceeded. Max {max_requests} requests per {window_seconds} seconds."
                    )
                
                # Record request
                _rate_limit_storage[client_ip].append(current_time)
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
