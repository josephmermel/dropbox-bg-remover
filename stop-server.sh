#!/bin/bash
# Double-click launcher: stops the dropbox-bg-remover web server.
# Prefers asking it to shut down cleanly via its own API; falls back to
# killing whatever is listening on the port if that's not possible.
PORT=3000

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:$PORT/api/shutdown")

if [ "$STATUS" = "200" ]; then
  echo "Server stopped."
elif [ "$STATUS" = "409" ]; then
  echo "A run is currently in progress. Use the Stop Server button on the web page to confirm, or wait for it to finish."
else
  PID=$(lsof -ti "tcp:$PORT")
  if [ -n "$PID" ]; then
    kill "$PID"
    echo "Server force-stopped."
  else
    echo "Server was not running."
  fi
fi

read -p "Press Enter to close this window..."
