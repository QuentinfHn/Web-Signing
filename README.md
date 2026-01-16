# Signage HTML LED Controller

LED-scherm controller met React frontend, tRPC backend, Prisma database, en Docker deployment.

## 🚀 Quick Start met Docker

```bash
# Start de services
./scripts/dev-up.sh

# Stop de services
./scripts/dev-down.sh
```

**URLs na starten:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

## 📁 Project Structuur

```
├── backend/          # Express + tRPC + Prisma
├── frontend/         # React + Vite
├── content/          # Afbeeldingen voor schermen
└── docker-compose.yml
```

## 🛠️ Development Setup

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed   # Laadt schermen & presets
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 📡 API Endpoints

- **tRPC**: `/trpc` - Type-safe API
- **WebSocket**: `ws://` - Realtime updates
- **Content**: `/content/*` - Afbeeldingen

## 🎮 Pagina's

| URL | Beschrijving |
|-----|--------------|
| `/` | Home met navigatie |
| `/control` | Control panel voor schermen |
| `/display?display=display1` | Display 1 output |
| `/display?display=display2` | Display 2 output |
