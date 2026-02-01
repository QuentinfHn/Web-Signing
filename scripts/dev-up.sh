#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIR="$ROOT_DIR/.dev"

mkdir -p "$DEV_DIR"

# Check if already running
if [ -f "$DEV_DIR/backend.pid" ] && kill -0 "$(cat "$DEV_DIR/backend.pid")" 2>/dev/null; then
    echo "Already running. Use ./scripts/dev-down.sh first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "$ROOT_DIR/backend/node_modules" ]; then
    echo "==> Installing backend dependencies..."
    npm --prefix "$ROOT_DIR/backend" install
    npm --prefix "$ROOT_DIR/backend" run db:generate
    npm --prefix "$ROOT_DIR/backend" run db:push
    npm --prefix "$ROOT_DIR/backend" run db:seed
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo "==> Installing frontend dependencies..."
    npm --prefix "$ROOT_DIR/frontend" install
fi

# Helper function to check if port is in use
port_in_use() {
    local port=$1
    if command -v lsof &>/dev/null; then
        lsof -ti tcp:"$port" >/dev/null 2>&1
    elif command -v powershell &>/dev/null; then
        powershell -Command "Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue" >/dev/null 2>&1
    elif command -v netstat &>/dev/null; then
        netstat -an | grep -q ":$port.*LISTEN"
    else
        return 1
    fi
}

# Check ports
if port_in_use 8080; then
    echo "Port 8080 already in use. Stop it first: ./scripts/dev-down.sh"
    exit 1
fi

if port_in_use 3000; then
    echo "Port 3000 already in use. Stop it first: ./scripts/dev-down.sh"
    exit 1
fi

echo "==> Starting backend (http://localhost:8080)"
nohup npm --prefix "$ROOT_DIR/backend" run dev >"$DEV_DIR/backend.log" 2>&1 &
echo $! >"$DEV_DIR/backend.pid"

sleep 1

echo "==> Starting frontend (http://localhost:3000)"
nohup npm --prefix "$ROOT_DIR/frontend" run dev >"$DEV_DIR/frontend.log" 2>&1 &
echo $! >"$DEV_DIR/frontend.pid"

sleep 1

echo
echo "✅ Started!"
echo "- Frontend: http://localhost:3000"
echo "- Backend:  http://localhost:8080"
echo "- Logs:     $DEV_DIR/backend.log & frontend.log"
echo
echo "Stop with: ./scripts/dev-down.sh"
