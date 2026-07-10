#!/bin/bash
# Release ports used by TraderMemos dev servers.
# Kills air parent + server children by process group, preventing respawn.
# Reads TM_HTTP_PORT from api/.env (defaults to 8080). Also frees Vite :5173.
# Usage: make kill

set -euo pipefail

API_PORT=$(grep -m1 '^TM_HTTP_PORT=' api/.env 2>/dev/null | cut -d= -f2 || true)
API_PORT=${API_PORT:-8080}
WEB_PORT=5173

# Find server PIDs and their parent (air) PIDs, kill entire process groups
for pid in $(pgrep -f "api/tmp/server" 2>/dev/null || true); do
  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
  if [ -n "$pgid" ] && [ "$pgid" != "0" ]; then
    kill -- -"$pgid" 2>/dev/null && echo "Killed process group $pgid" || true
  else
    kill -9 "$pid" 2>/dev/null || true
  fi
done

# Also kill any standalone air processes
pkill -9 -f "air" 2>/dev/null || true

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Port $port: killing remaining listeners"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  else
    echo "Port $port: free"
  fi
}

sleep 0.5
kill_port "$API_PORT"
kill_port "$WEB_PORT"
