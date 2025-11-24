# Quick Fix: Backend Connection Issue

## Issue
The backend server appears to have stopped. The endpoint exists but server isn't responding.

## Solution

### Step 1: Restart Backend

Open a new terminal and run:
```bash
cd C:\Users\Absolomjr\Desktop\Vanguard\backend
call ..\venv\Scripts\activate.bat
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Step 2: Verify Backend is Running

In another terminal or browser, test:
```bash
curl http://localhost:8000/api/health
```

Or open in browser: `http://localhost:8000/docs`

### Step 3: Create Test Data

Once backend is running, in browser console (F12), run:

```javascript
fetch('http://localhost:8000/api/test-data/create', { 
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(r => {
    if (!r.ok) {
      throw new Error(`HTTP error! status: ${r.status}`);
    }
    return r.json();
  })
  .then(data => {
    console.log('✓ Test data created:', data);
    window.location.reload();
  })
  .catch(error => {
    console.error('✗ Error:', error);
    alert('Error: ' + error.message);
  });
```

### Step 4: Check for Errors

If you see errors in the console, check:

1. **CORS Error**: Backend CORS is enabled, but verify backend is running
2. **404 Error**: Endpoint not found - server needs restart
3. **500 Error**: Database issue - check backend logs
4. **Connection Refused**: Backend not running

### Alternative: Use API Docs

1. Go to: `http://localhost:8000/docs`
2. Find `/api/test-data/create` endpoint
3. Click "Try it out"
4. Click "Execute"
5. Check response

### If Still Not Working

Check backend terminal for errors. Common issues:
- Database connection error
- Import errors
- Port 8000 already in use

