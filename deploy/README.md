# Deployment

## Quick Start

1. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   nano .env
   ```

2. Run the deployment:
   ```bash
   chmod +x deploy/deploy.sh
   ./deploy/deploy.sh
   ```

## First Time Setup on Server

```bash
# Clone the repository
git clone <your-repo-url> /opt/signage-led
cd /opt/signage-led

# Configure environment
cp .env.example .env
nano .env

# Deploy
./deploy/deploy.sh
```

## Updating

```bash
cd /opt/signage-led
git pull origin main
./deploy/deploy.sh
```
