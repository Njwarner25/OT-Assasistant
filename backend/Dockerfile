# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
RUN npm install --legacy-peer-deps ajv@6.12.5 ajv-keywords@3.5.2
COPY frontend/ ./
RUN CI=false REACT_APP_BACKEND_URL='' npm run build

# Stage 2: Python backend + serve built frontend
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py ./
COPY --from=frontend-builder /app/frontend/build ./frontend/build
EXPOSE 8000
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
