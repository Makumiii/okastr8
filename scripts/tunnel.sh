#!/usr/bin/env bash
set -eou pipefail

# This script starts a reusable ngrok tunnel for any service (default: okastr8 manager)

CONFIG_FILE="$HOME/.okastr8/config.json"
DEFAULT_PORT=8788
DEFAULT_PROTO="http"

PORT="${1:-$DEFAULT_PORT}"
PROTO="${2:-$DEFAULT_PROTO}"
NAME="${3:-manager}" # Optional label for clarity/logging

if ! command -v jq &> /dev/null; then
  echo "❌ jq is required. Please run setup.sh." >&2
  exit 1
fi

if ! command -v ngrok &> /dev/null; then
  echo "❌ ngrok is not installed. Please run setup.sh." >&2
  exit 1
fi

# Configure ngrok authtoken if available
AUTHTOKEN=$(jq -r '.networking.ngrok.authToken // empty' "$CONFIG_FILE" 2>/dev/null || echo "")
if [ -n "$AUTHTOKEN" ]; then
  echo "🔐 Configuring ngrok authtoken..."
  ngrok config add-authtoken "$AUTHTOKEN"
else
  echo "⚠️  No authtoken found. Please add it to ~/.okastr8/config.json under networking.ngrok.authToken"
fi

echo "🚀 Starting ngrok tunnel for $NAME service at port $PORT using $PROTO"

NGROK_LOG_FILE=$(mktemp)
ngrok "$PROTO" "$PORT" > "$NGROK_LOG_FILE" 2>&1 &
NGROK_PID=$!

sleep 5

if ! ps -p $NGROK_PID > /dev/null; then
  echo "❌ ngrok failed to start." >&2
  cat "$NGROK_LOG_FILE" >&2
  rm "$NGROK_LOG_FILE"
  exit 1
fi

PUBLIC_URL=""
for i in {1..10}; do
  PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url // ""' || true)
  [ -n "$PUBLIC_URL" ] && break
  sleep 1
done

if [ -n "$PUBLIC_URL" ]; then
  echo "
✅ Tunnel active!
Label: $NAME
Port: $PORT
Public URL: $PUBLIC_URL
"

  # Clipboard copy
  if command -v xclip &> /dev/null; then
    echo "$PUBLIC_URL" | xclip -selection clipboard
    echo "(Copied to clipboard ✅)"
  elif command -v pbcopy &> /dev/null; then
    echo "$PUBLIC_URL" | pbcopy
    echo "(Copied to clipboard ✅)"
  else
    echo "(Install xclip/pbcopy to auto-copy)"
  fi
else
  echo "❌ Could not retrieve public URL." >&2
  echo "See logs: $NGROK_LOG_FILE" >&2
fi

# Optionally log the tunnel info to file (e.g. ~/.okastr8/tunnels.json)
mkdir -p "$HOME/.okastr8"
TUNNEL_LOG="$HOME/.okastr8/tunnel_${NAME}.json"
jq -n --arg name "$NAME" --arg port "$PORT" --arg url "$PUBLIC_URL" \
  '{service: $name, port: $port, url: $url}' > "$TUNNEL_LOG"

# Clean up logs and wait to keep tunnel alive
rm "$NGROK_LOG_FILE"
wait $NGROK_PID
