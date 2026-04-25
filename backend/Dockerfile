# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /build
COPY backend/frontend/package*.json ./
RUN npm install --legacy-peer-deps
RUN npm install --legacy-peer-deps ajv@6.12.5 ajv-keywords@3.5.2
COPY backend/frontend/ ./
RUN CI=false REACT_APP_BACKEND_URL='' npm run build

# Stage 2: Python backend + serve built frontend
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/server.py ./
COPY --from=frontend-builder /build/build ./frontend/build
EXPOSE 8000
CMD sh -c "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"
