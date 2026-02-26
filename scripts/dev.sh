#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "StyleCue dev server"
echo "==================="

# ── Backend ─────────────────────────────────────────────────────────────────
cd "$REPO_ROOT/backend"

if [ ! -f .env ]; then
  echo "[warn] backend/.env not found — copying .env.example"
  cp .env.example .env
fi

echo "[backend] starting uvicorn on http://localhost:8000 ..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────────────────────
cd "$REPO_ROOT/frontend"

if [ ! -d node_modules ]; then
  echo "[frontend] installing dependencies ..."
  npm install
fi

echo "[frontend] starting vite on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

# ── Shutdown ─────────────────────────────────────────────────────────────────
echo ""
echo "Services:"
echo "  API:      http://localhost:8000"
echo "  Swagger:  http://localhost:8000/docs"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl-C to stop both services."

cleanup() {
  echo ""
  echo "Stopping services…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
}

trap cleanup SIGINT SIGTERM
wait
