#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIR="$ROOT_DIR/.dev"

echo "🛑 Stopping LED Controller..."

# Stop Docker containers if running
docker-compose -f "$ROOT_DIR/docker-compose.yml" down 2>/dev/null || true

# Kill backend
if [ -f "$DEV_DIR/backend.pid" ]; then
    PID=$(cat "$DEV_DIR/backend.pid")
    kill "$PID" 2>/dev/null || true
    rm -f "$DEV_DIR/backend.pid"
fi

# Kill frontend
if [ -f "$DEV_DIR/frontend.pid" ]; then
    PID=$(cat "$DEV_DIR/frontend.pid")
    kill "$PID" 2>/dev/null || true
    rm -f "$DEV_DIR/frontend.pid"
fi

# Force kill any remaining processes on the ports
lsof -ti tcp:8080 | xargs kill -9 2>/dev/null || true
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true

echo "✅ Stopped!"
