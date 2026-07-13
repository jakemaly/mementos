#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill sidecar (port 8000)
lsof -ti:8000 | xargs kill 2>/dev/null || true

# Kill frontend (port 3000)
lsof -ti:3000 | xargs kill 2>/dev/null || true

# Tear down Qdrant
docker compose -f "$ROOT/app/docker-compose.yml" down 2>/dev/null || true

echo "All stopped."
