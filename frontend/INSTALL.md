# Frontend Installation Fix

If you're getting the error `'vite' is not recognized as an internal or external command`, you need to install the dependencies first.

## Quick Fix

Run this command in the `frontend` directory:

```powershell
npm install
```

Or from the project root:

```powershell
cd frontend
npm install
cd ..
```

## Verify Installation

After running `npm install`, you should see a `node_modules` directory created in the `frontend` folder.

Then you can run:

```powershell
npm run dev
```

## Alternative: Use npx

If npm install doesn't work, you can use npx directly:

```powershell
npx vite
```

## Troubleshooting

1. **Make sure Node.js is installed:**
   ```powershell
   node --version
   npm --version
   ```

2. **Clear npm cache if needed:**
   ```powershell
   npm cache clean --force
   ```

3. **Delete node_modules and package-lock.json, then reinstall:**
   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item package-lock.json
   npm install
   ```

