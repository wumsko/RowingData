# RowingData Docker Setup

This document explains how to run the RowingData application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (usually comes with Docker Desktop)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Build and run the application:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   Open your browser and go to `http://localhost:8080`

3. **Stop the application:**
   ```bash
   docker-compose down
   ```

### Option 2: Using Docker directly

1. **Build the Docker image:**
   ```bash
   docker build -t rowingdata .
   ```

2. **Run the container:**
   ```bash
   docker run -p 8000:8000 rowingdata
   ```

3. **Access the application:**
   Open your browser and go to `http://localhost:8000`

## What's Included

The Docker container includes:

- **Backend**: FastAPI server with all scraping functionality
- **Frontend**: Static HTML, CSS, and JavaScript files
- **API Endpoints**: All the original endpoints (/races, /fields, /entries)
- **Static File Serving**: The frontend is served directly by FastAPI

## Configuration

### Environment Variables

You can set environment variables in the `docker-compose.yml` file:

```yaml
environment:
  - PYTHONUNBUFFERED=1
  # Add other environment variables as needed
```

### Port Configuration

The default port is 8000. To change it, modify the `docker-compose.yml`:

```yaml
ports:
  - "YOUR_PORT:8000"
```

## Development

### Running in Development Mode

For development, you might want to mount the source code as a volume:

```yaml
volumes:
  - .:/app
```

### Viewing Logs

```bash
docker-compose logs -f
```

### Accessing the Container

```bash
docker-compose exec rowingdata bash
```

## Troubleshooting

### Port Already in Use

If port 8000 is already in use, change the port in `docker-compose.yml`:

```yaml
ports:
  - "8001:8000"  # Use port 8001 on your host
```

### Build Issues

If you encounter build issues:

1. **Clean Docker cache:**
   ```bash
   docker system prune -a
   ```

2. **Rebuild without cache:**
   ```bash
   docker-compose build --no-cache
   ```

### Health Check Issues

The container includes a health check that verifies the API is working. If it fails:

1. Check the logs: `docker-compose logs`
2. Verify the API endpoint: `curl http://localhost:8000/races`

## Production Deployment

For production deployment:

1. **Use a production WSGI server:**
   ```dockerfile
   CMD ["gunicorn", "APIBackend:app", "--bind", "0.0.0.0:8000", "--workers", "4"]
   ```

2. **Add environment variables for configuration**
3. **Set up proper logging**
4. **Configure reverse proxy (nginx) if needed**

## API Endpoints

Once running, the following endpoints are available:

- `GET /` - Main application page
- `GET /races` - List all available races
- `GET /fields?race_url=...` - Get fields for a specific race
- `GET /entries?race_url=...` - Get crew entries for a field
- `GET /static/*` - Static files (CSS, JS, images)

The application is now completely self-contained and doesn't rely on external hosting for the backend!
