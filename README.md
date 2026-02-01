# Signage HTML LED Controller

Web-based LED screen controller with React frontend, tRPC backend, Prisma database, and Docker deployment.

## 📋 Prerequisites

Before starting, make sure you have installed:

- **Node.js** (version 20 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

## 🚀 Quick Start

### Mac / Linux

1. **Clone and navigate to the project:**
   ```bash
   git clone https://github.com/QuentinfHn/Web-Signing.git
   cd Signing
   ```

2. **Start the development server:**
   ```bash
   ./scripts/dev-up.sh
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

4. **Stop the server:**
   ```bash
   ./scripts/dev-down.sh
   ```

### Windows

1. **Clone and navigate to the project:**
   ```cmd
   git clone https://github.com/QuentinfHn/Web-Signing.git
   cd Signing
   ```

2. **Install all dependencies:**
   ```cmd
   npm run install:all
   ```

3. **Set up the database:**
   ```cmd
   cd backend
   npx prisma generate
   npx prisma db push
   npm run db:seed
   cd ..
   ```

4. **Start both servers:**
   ```cmd
   npm run dev
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

6. **Stop the server:**
   - Press `Ctrl+C` in the terminal

## 📁 Project Structure

```
├── backend/          # Express + tRPC + Prisma API server
├── frontend/         # React + Vite web application
├── content/          # Static content (uploaded images)
├── scripts/          # Development helper scripts (Mac/Linux)
└── docker-compose.yml # Docker configuration
```

## 🛠️ Development

### Manual Setup (Both Platforms)

If you want to run the servers separately or need more control:

#### Backend

```bash
cd backend
npm install
npx prisma generate    # Generate Prisma client
npx prisma db push     # Create/sync database
npm run db:seed        # Load default screens & presets
npm run dev            # Start development server
```

The backend will run on http://localhost:8080

#### Frontend

```bash
cd frontend
npm install
npm run dev            # Start Vite development server
```

The frontend will run on http://localhost:3000

### Available Commands

From the project root:

```bash
npm run install:all    # Install all dependencies
npm run dev            # Run both backend and frontend
npm run build          # Build both for production
npm run test           # Run all tests
npm run lint           # Check code quality
npm run lint:fix       # Fix linting issues
```

### Database Management

```bash
cd backend
npx prisma studio      # Open database GUI
npx prisma db push     # Update database schema
npx prisma db seed     # Reset with default data
```

## 📡 API Endpoints

- **tRPC API**: `/trpc` - Type-safe API endpoints
- **WebSocket**: `ws://localhost:8080` - Real-time updates
- **Content**: `/content/*` - Static image files
- **Companion API**: `/api/companion/*` - External integrations
- **Health Check**: `/health` - Service status

## 🐳 Docker Deployment

### Development with Docker

```bash
docker compose up -d
```

### Production Deployment

#### First Time Setup

1. **Clone the repository:**
   ```bash
   sudo mkdir -p /opt/signage-led
   sudo chown -R $USER:$USER /opt/signage-led
   cd /opt/signage-led
   git clone https://github.com/QuentinfHn/Web-Signing.git .
   ```

2. **Install Docker (if not already installed):**
   ```bash
   sudo bash deploy/scripts/install-docker.sh
   sudo usermod -aG docker $USER
   # Log out and log back in for group changes to take effect
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env
   ```

   **Required settings for production:**
   - `NODE_ENV=production`
   - `FRONTEND_URL` - Your domain (e.g., `https://signage.example.com`)
   - `JWT_SECRET` - Secure random string (generate with: `openssl rand -base64 32`)

   **Optional settings:**
   - `TUNNEL_TOKEN` - Cloudflare tunnel token for secure public access
   - `ADMIN_PASSWORD` - Password protection for control panel
   - `BACKEND_PORT` - Backend port (default: 8080)
   - `FRONTEND_PORT` - Frontend port (default: 3000)

4. **Deploy:**
   ```bash
   chmod +x deploy/deploy.sh
   ./deploy/deploy.sh
   ```

   This script will:
   - Pull the latest pre-built images from GitHub Container Registry
   - Start all services (backend, frontend, and optionally Cloudflare tunnel)
   - Run health checks to verify deployment

5. **Access your application:**
   - Frontend: `http://your-server-ip:3000`
   - Backend API: `http://your-server-ip:8080`
   - If using Cloudflare Tunnel: `https://your-domain.com`

#### Updating Production

To update to the latest version:

```bash
cd /opt/signage-led
git pull origin main
./deploy/deploy.sh
```

#### Manual Docker Deployment

If you prefer manual control:

```bash
# Without Cloudflare Tunnel
docker compose up -d

# With Cloudflare Tunnel
docker compose --profile tunnel up -d
```

## 🔧 Troubleshooting

### Port Already in Use

**Mac/Linux:**
```bash
./scripts/dev-down.sh  # This will kill processes on ports 8080 and 3000
```

**Windows:**
```cmd
# Find process on port 8080
netstat -ano | findstr :8080
# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Find process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Issues

Delete the database and recreate:
```bash
cd backend
rm -rf data/led.db     # Mac/Linux
# del data\led.db      # Windows
npx prisma db push
npm run db:seed
```