# Stage 1: Build frontend (React Vite)
FROM node:18 AS frontend-builder

# Set working directory for frontend
WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy full frontend source
COPY frontend/ ./

# Build production
RUN npm run build

# Stage 2: Build backend (FastAPI + Python)
FROM python:3.10-slim AS backend

# Install system dependencies for pandas, numpy etc.
RUN apt-get update && apt-get install -y gcc g++ libpq-dev

# Set working directory for backend
WORKDIR /app

# Copy backend code
COPY backend/ ./backend/

# Copy requirements
COPY backend/requirements.txt ./backend/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy frontend build from stage 1 vào backend
COPY --from=frontend-builder /app/frontend/dist ./backend/frontend/build

# Set working directory to backend
WORKDIR /app/backend

# Expose port (8000 = FastAPI port)
EXPOSE 8000

# Default command run backend uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
