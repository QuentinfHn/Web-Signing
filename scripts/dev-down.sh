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
if command -v lsof &>/dev/null; then
    # Unix/macOS
    lsof -ti tcp:8080 | xargs kill -9 2>/dev/null || true
    lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
elif command -v powershell &>/dev/null; then
    # Windows (Git Bash / MINGW)
    powershell -Command "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>/dev/null || true
    powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>/dev/null || true
fi

echo "✅ Stopped!"
