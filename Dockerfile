# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire project
COPY . .

# Create a directory for static files
RUN mkdir -p /app/static

# Copy frontend files to static directory
COPY index.html /app/static/
COPY script.js /app/static/
COPY style.css /app/static/

# Expose port
EXPOSE 80

# Create a startup script
RUN echo '#!/bin/bash\n\
cd /app\n\
uvicorn APIBackend:app --host 0.0.0.0 --port 80\n\
' > /app/start.sh && chmod +x /app/start.sh

# Set the startup command
CMD ["/app/start.sh"]
