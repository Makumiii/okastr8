#!/usr/bin/env bash
set -eou pipefail

# This script starts a reusable ngrok tunnel for any service (default: okastr8 manager)

CONFIG_FILE="$HOME/.okastr8/config.json"
DEFAULT_PORT=8788
DEFAULT_PROTO="http"

PORT="${1:-$DEFAULT_PORT}"
PROTO="${2:-$DEFAULT_PROTO}"
NAME="${3:-manager}" # Optional label for clarity/logging

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ jq is required. Please run setup.sh." >&2
  exit 1
fi

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
  echo "❌ ngrok is not installed. Please run setup.sh first." >&2
  exit 1
fi

# Read authtoken from config.json and configure if present
AUTHTOKEN=""
if [ -f "$CONFIG_FILE" ]; then
  AUTHTOKEN=$(jq -r '.networking.ngrok.authToken // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  if [ -n "$AUTHTOKEN" ]; then
    echo "🔐 Configuring ngrok authtoken from $CONFIG_FILE..."
    ngrok config add-authtoken "$AUTHTOKEN"
  else
    echo "Warning: Ngrok authtoken not found in $CONFIG_FILE. Tunnel will start unauthenticated." >&2
    echo "To persist your ngrok configuration, add your authtoken to networking.ngrok.authToken in $CONFIG_FILE." >&2
    echo "Get your authtoken from: https://dashboard.ngrok.com/get-started/setup" >&2
  fi
else
  echo "Warning: Config file not found at $CONFIG_FILE. Tunnel will start unauthenticated." >&2
  echo "Please ensure ~/.okastr8/config.json exists and contains your authtoken." >&2
  echo "Get your authtoken from: https://dashboard.ngrok.com/get-started/setup" >&2
fi

echo "🚀 Starting ngrok tunnel for $NAME service at port $PORT using $PROTO"

# Start ngrok tunnel and capture output
# Use a temporary file to store ngrok's stdout/stderr
NGROK_LOG_FILE=$(mktemp)

# Run ngrok in the background
ngrok "$PROTO" "$PORT" > "$NGROK_LOG_FILE" 2>&1 &
NGROK_PID=$!

# Give ngrok a moment to start and establish the tunnel
sleep 5

# Check if ngrok process is still running
if ! ps -p $NGROK_PID > /dev/null; then
  echo "❌ ngrok failed to start." >&2
  cat "$NGROK_LOG_FILE" >&2 # Output ngrok's logs for debugging
  rm "$NGROK_LOG_FILE"
  exit 1
fi

# Try to get the public URL from ngrok's API
PUBLIC_URL=""
for i in {1..10}; do # Retry a few times
  PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url // ""' || true)
  if [ -n "$PUBLIC_URL" ]; then
    break
  fi
  sleep 1
done

if [ -n "$PUBLIC_URL" ]; then
  echo "
✅ Tunnel active!
Label: $NAME
Port: $PORT
Public URL: $PUBLIC_URL
"

  # Copy to clipboard if xclip (Linux) or pbcopy (macOS) is available
  if command -v xclip &> /dev/null; then
    echo "$PUBLIC_URL" | xclip -selection clipboard
    echo "(Copied to clipboard ✅)"
  elif command -v pbcopy &> /dev/null; then # macOS
    echo "$PUBLIC_URL" | pbcopy
    echo "(Copied to clipboard ✅)"
  else
    echo "(Install xclip or pbcopy to automatically copy URL to clipboard)"
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

# Clean up log file
rm "$NGROK_LOG_FILE"

# Keep the script running to keep the tunnel alive
wait $NGROK_PID