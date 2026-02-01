#!/usr/bin/env bash
set -euo pipefail

# Deploys LED Signage Controller using pre-built images from GHCR
# Run this on the server from the repo root:
#   ./deploy/deploy.sh

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE="$ROOT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Create it from $ROOT_DIR/.env.example" >&2
  exit 1
fi

# Determine if we should use the tunnel profile
COMPOSE_PROFILES=""
if grep -q '^TUNNEL_TOKEN=' "$ENV_FILE" && grep '^TUNNEL_TOKEN=' "$ENV_FILE" | grep -qv '=$'; then
  COMPOSE_PROFILES="--profile tunnel"
  echo "Cloudflare Tunnel enabled"
fi

cd "$ROOT_DIR"

# Pull pre-built images from GHCR
echo "==> Pulling images from GHCR..."
docker compose --env-file "$ENV_FILE" $COMPOSE_PROFILES pull

# Start services
echo "==> Starting services..."
docker compose --env-file "$ENV_FILE" $COMPOSE_PROFILES up -d --remove-orphans

# Print status
echo ""
echo "==> Container status:"
docker compose --env-file "$ENV_FILE" $COMPOSE_PROFILES ps

# Run post-deploy health check
echo ""
echo "==> Running post-deploy checks..."
chmod +x "$ROOT_DIR/deploy/scripts/check.sh"
"$ROOT_DIR/deploy/scripts/check.sh"
