#!/usr/bin/env python3
"""Check registered routes in FastAPI app."""

import sys
from pathlib import Path  
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.main import app

print("\n" + "=" * 60)
print("REGISTERED ROUTES IN FASTAPI APP")
print("=" * 60 + "\n")

for route in app.routes:
    if hasattr(route, 'path'):
        methods = getattr(route, 'methods', None)
        if methods:
            methods_str = ','.join(methods)
        else:
            methods_str = 'WebSocket'
        
        if 'ws' in route.path or 'websocket' in route.path.lower():
            print(f"[WS] {route.path} - {methods_str}")
    
    if hasattr(route, 'path') and '/api' in route.path:
        print(f"[API] {route.path}")

print("\n" + "=" * 60)
print("Total routes:", len(app.routes))
