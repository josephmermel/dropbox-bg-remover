#!/bin/bash
# Double-click launcher: starts the dropbox-bg-remover web server in the
# background and opens it in the default browser.
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Make sure common Node/Homebrew locations are on PATH even if this Terminal
# session doesn't pick them up automatically.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PORT=3000
LOG_FILE="$DIR/server.log"

if ! command -v npm >/dev/null 2>&1; then
  echo "Could not find npm. Make sure Node.js is installed on this Mac."
  read -p "Press Enter to close this window..."
  exit 1
fi

if curl -s -o /dev/null "http://localhost:$PORT"; then
  echo "Server is already running at http://localhost:$PORT"
  open "http://localhost:$PORT"
  read -p "Press Enter to close this window..."
  exit 0
fi

echo "Starting server..."
nohup npm run serve >> "$LOG_FILE" 2>&1 &
disown

for _ in $(seq 1 20); do
  if curl -s -o /dev/null "http://localhost:$PORT"; then
    echo "Server is up."
    open "http://localhost:$PORT"
    read -p "Press Enter to close this window..."
    exit 0
  fi
  sleep 1
done

echo "The server didn't start in time. Check server.log in this folder for details."
read -p "Press Enter to close this window..."
exit 1
