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

### 1. Prepare directory and clone

```bash
sudo mkdir -p /opt/signage-led
sudo chown -R $USER:$USER /opt/signage-led
cd /opt/signage-led

# Option A: GitHub CLI (recommended)
gh repo clone meesvandenberg/Signage-HTML-LED-controller .

# Option B: Standard Git
# git clone https://github.com/meesvandenberg/Signage-HTML-LED-controller.git .

# NOTE: Don't forget the dot '.' at the end to clone into the current directory!
```

### 2. Install Dependencies

```bash
# Installs Docker + Docker Compose plugin
sudo bash deploy/scripts/install-docker.sh

# Add current user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# IMPORTANT: Log out and log back in for the group change to take effect!
```

### 3. Configure and Deploy

```bash
# Configure environment
cp .env.example .env
nano .env

# Deploy
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

## Updating

```bash
cd /opt/signage-led
git pull origin main
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```
