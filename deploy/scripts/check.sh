#!/usr/bin/env bash
set -euo pipefail

# Post-deploy health check for LED Signage Controller

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DEPLOY_DIR="$ROOT_DIR/deploy"

echo "Checking service health..."

# Wait for services to be ready
sleep 5

# Check backend health endpoint
echo -n "Backend health: "
if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
  echo "Backend is not responding on http://localhost:8080/health"
  exit 1
fi

# Check frontend is serving
echo -n "Frontend:       "
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  echo "OK"
else
  echo "FAILED"
  echo "Frontend is not responding on http://localhost:3000"
  exit 1
fi

echo ""
echo "All checks passed!"
echo "  Backend:  http://localhost:8080"
echo "  Frontend: http://localhost:3000"
