#!/bin/bash
set -e

echo "=== Building React frontend ==="
cd frontend
npm install --legacy-peer-deps
REACT_APP_BACKEND_URL="" npm run build
cd ..

echo "=== Installing Python dependencies ==="
cd backend
pip install -r requirements.txt

echo "=== Build complete ==="
