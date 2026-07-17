#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# 1. Load .env if it exists
if [[ -f "$ROOT/.env" ]]; then
  set -a
  source "$ROOT/.env"
  set +a
fi

# Check required vars
for var in OPENAI_API_KEY OPENAI_API_BASE OPENAI_MODEL_NAME TDRANT_URL:-http://localhost:6333; do
  key="${var%%:*}"
  val="${!key:-}"
  if [[ -z "$val" && "$var" != *":-"* ]]; then
    echo "ERROR: $key is not set" >&2
    exit 1
  fi
done

# 2. Start Qdrant
echo "Starting Qdrant..."
docker compose -f "$ROOT/app/docker-compose.yml" up -d

# 3. Start sidecar
echo "Starting sidecar..."
cd "$ROOT/sidecar"
python -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 8000 &
SIDECAR_PID=$!

# 4. Start frontend
echo "Starting frontend..."
cd "$ROOT/app"
npm install --silent
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "  Mementos is running"
echo "  Dashboard:  http://localhost:3000"
echo "  Sidecar:    http://localhost:8000/docs"
echo "  Press Ctrl+C to stop"
echo "========================================="

# Cleanup on exit
cleanup() {
  echo "Shutting down..."
  kill $SIDECAR_PID $FRONTEND_PID 2>/dev/null || true
  docker compose -f "$ROOT/app/docker-compose.yml" down
  exit 0
}
trap cleanup INT TERM

wait
