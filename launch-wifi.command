#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${SCRIPT_DIR}"
PORT=3000
LOG_FILE="${APP_DIR}/.next/dev-server.log"

# Function to get the local IP address on macOS
get_local_ip() {
    ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost"
}

LOCAL_IP=$(get_local_ip)
URL="http://${LOCAL_IP}:${PORT}"

cd "${APP_DIR}"

if curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; then
  echo "Productivity Tool is already running"
  echo "Opening ${URL}"
  open "${URL}"
  exit 0
fi

if [ ! -d "node_modules" ]; then
  echo "Dependencies are missing. Running npm install..."
  npm install
fi

mkdir -p "${APP_DIR}/.next"

# Stop existing processes on the port
EXISTING_PIDS="$(lsof -ti tcp:${PORT} || true)"
if [ -n "${EXISTING_PIDS}" ]; then
  echo "Stopping existing process on port ${PORT}: ${EXISTING_PIDS}"
  kill ${EXISTING_PIDS} || true
  sleep 1

  REMAINING_PIDS="$(lsof -ti tcp:${PORT} || true)"
  if [ -n "${REMAINING_PIDS}" ]; then
    echo "Force-stopping remaining process on port ${PORT}: ${REMAINING_PIDS}"
    kill -9 ${REMAINING_PIDS} || true
  fi
fi

rm -f "${LOG_FILE}"

echo "------------------------------------------------------------"
echo "🚀 Starting Productivity Tool for WiFi access"
echo "📍 Local URL: http://localhost:${PORT}"
echo "🌐 Network URL: ${URL}"
echo "------------------------------------------------------------"

# Run next dev on all interfaces
nohup npm run dev -- --hostname 0.0.0.0 --port "${PORT}" > "${LOG_FILE}" 2>&1 &
SERVER_PID=$!

cleanup() {
  if ps -p "${SERVER_PID}" > /dev/null 2>&1; then
    echo "Stopping dev server ${SERVER_PID}"
    kill "${SERVER_PID}" || true
  fi
}

trap cleanup INT TERM

# Wait for server to be ready
echo "Waiting for server to start..."
for _ in {1..60}; do
  if curl -sf "http://localhost:${PORT}" > /dev/null 2>&1; then
    open "${URL}"
    echo "✅ Running at ${URL}"
    echo "📝 Logs: ${LOG_FILE}"
    wait "${SERVER_PID}"
    exit 0
  fi
  sleep 1
done

echo "❌ Server did not become ready in time. Last log output:"
tail -n 40 "${LOG_FILE}" || true
cleanup
exit 1
