#!/usr/bin/env bash
# Starts the FastAPI backend (port 8000) and the React dev server (port 5173).
# Press Ctrl+C once to stop both.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -x backend/.venv/bin/uvicorn ]; then
  echo "Python environment not found. Run ./scripts/setup.sh first." >&2
  exit 1
fi
if [ ! -d frontend/node_modules ]; then
  echo "Frontend packages not found. Run ./scripts/setup.sh first." >&2
  exit 1
fi

make -C backend/compiler >/dev/null

(cd backend && exec .venv/bin/uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!
(cd frontend && exec npm run dev -- --host 127.0.0.1) &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo
echo "MiniCC is starting."
echo "  App:      http://localhost:5173"
echo "  API docs: http://localhost:8000/docs"
echo

wait
