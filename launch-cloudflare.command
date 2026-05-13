#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${SCRIPT_DIR}"
PORT=3000
LOCAL_URL="http://localhost:${PORT}"
LOG_DIR="${APP_DIR}/.next"
APP_LOG_FILE="${LOG_DIR}/dev-server.log"
TUNNEL_LOG_FILE="${LOG_DIR}/cloudflare-tunnel.log"

cd "${APP_DIR}"

if ! command -v cloudflared > /dev/null 2>&1; then
  echo "cloudflared is not installed."
  echo "Install it first with:"
  echo "  brew install cloudflare/cloudflare/cloudflared"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Dependencies are missing. Running npm install..."
  npm install
fi

mkdir -p "${LOG_DIR}"

SERVER_PID=""

cleanup() {
  if [ -n "${SERVER_PID}" ] && ps -p "${SERVER_PID}" > /dev/null 2>&1; then
    echo "Stopping dev server ${SERVER_PID}"
    kill "${SERVER_PID}" || true
  fi
}

trap cleanup INT TERM

if curl -sf "${LOCAL_URL}" > /dev/null 2>&1; then
  echo "Productivity Tool is already running at ${LOCAL_URL}"
else
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

  rm -f "${APP_LOG_FILE}"

  echo "Starting Productivity Tool at ${LOCAL_URL}"
  nohup npm run dev -- --hostname 0.0.0.0 --port "${PORT}" > "${APP_LOG_FILE}" 2>&1 &
  SERVER_PID=$!

  echo "Waiting for local app to start..."
  for _ in {1..60}; do
    if curl -sf "${LOCAL_URL}" > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! curl -sf "${LOCAL_URL}" > /dev/null 2>&1; then
    echo "Local app did not become ready in time. Last log output:"
    tail -n 40 "${APP_LOG_FILE}" || true
    cleanup
    exit 1
  fi
fi

rm -f "${TUNNEL_LOG_FILE}"

echo "------------------------------------------------------------"
echo "Starting temporary Cloudflare Tunnel"
echo "Local app: ${LOCAL_URL}"
echo ""
echo "Cloudflare will print a public https://*.trycloudflare.com URL below."
echo "Keep this terminal window open while you want the public URL to work."
echo "This temporary URL changes each time you run this launcher."
echo "Tunnel logs: ${TUNNEL_LOG_FILE}"
echo "------------------------------------------------------------"

open "${LOCAL_URL}"

cloudflared tunnel --url "${LOCAL_URL}" 2>&1 | tee "${TUNNEL_LOG_FILE}"
