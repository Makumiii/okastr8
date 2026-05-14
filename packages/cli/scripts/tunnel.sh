#!/usr/bin/env bash
set -eou pipefail

# This script starts a reusable ngrok tunnel for any service (default: okastr8 manager)
# Handles existing ngrok sessions gracefully

CONFIG_FILE="$HOME/.okastr8/config.json"
DEFAULT_PORT=41788
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

# Check for existing ngrok processes
check_existing_ngrok() {
  local existing_pids=$(pgrep ngrok || true)
  if [ -n "$existing_pids" ]; then
    echo "⚠️  Found existing ngrok processes (PIDs: $existing_pids)"
    echo "Options:"
    echo "  1) Kill existing sessions and start new tunnel"
    echo "  2) Try to reuse existing tunnel (if port matches)"
    echo "  3) Exit and manage manually"
    
    read -p "Choose option (1/2/3): " choice
    
    case $choice in
      1)
        echo "🔪 Killing existing ngrok processes..."
        sudo pkill -f ngrok || killall ngrok || true
        sleep 2
        echo "✅ Existing sessions terminated"
        return 0
        ;;
      2)
        echo "🔍 Checking existing tunnel..."
        check_existing_tunnel
        return $?
        ;;
      3)
        echo "👋 Exiting. Check https://dashboard.ngrok.com/agents to manage sessions"
        exit 0
        ;;
      *)
        echo "❌ Invalid choice"
        exit 1
        ;;
    esac
  fi
  return 0
}

# Check if existing tunnel serves our port
check_existing_tunnel() {
  local api_response=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null || echo '{}')
  local existing_url=$(echo "$api_response" | jq -r ".tunnels[] | select(.config.addr == \"http://localhost:$PORT\") | .public_url" 2>/dev/null || true)
  
  if [ -n "$existing_url" ] && [ "$existing_url" != "null" ]; then
    echo "✅ Found existing tunnel for port $PORT: $existing_url"
    
    # Copy to clipboard
    if command -v xclip &> /dev/null; then
      echo "$existing_url" | xclip -selection clipboard
      echo "(Copied to clipboard ✅)"
    elif command -v pbcopy &> /dev/null; then
      echo "$existing_url" | pbcopy
      echo "(Copied to clipboard ✅)"
    fi
    
    # Log the tunnel info
    mkdir -p "$HOME/.okastr8"
    TUNNEL_LOG="$HOME/.okastr8/tunnel_${NAME}.json"
    jq -n --arg name "$NAME" --arg port "$PORT" --arg url "$existing_url" \
      '{service: $name, port: $port, url: $url}' > "$TUNNEL_LOG"
    
    echo "Using existing tunnel. Press Ctrl+C to exit monitoring."
    
    # Monitor the existing ngrok process
    local ngrok_pid=$(pgrep ngrok | head -1)
    if [ -n "$ngrok_pid" ]; then
      wait $ngrok_pid
    fi
    return 0
  else
    echo "❌ Existing tunnel doesn't serve port $PORT"
    echo "Kill the existing session to start a new one for port $PORT"
    return 1
  fi
}

# Main execution starts here
echo "🚀 Starting ngrok tunnel for $NAME service at port $PORT using $PROTO"

# Check for existing ngrok sessions
check_existing_ngrok

# Read authtoken from config.json and configure if present
AUTHTOKEN=""
if [ -f "$CONFIG_FILE" ]; then
  AUTHTOKEN=$(jq -r '.networking.ngrok.authToken // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  if [ -n "$AUTHTOKEN" ]; then
    echo "🔐 Configuring ngrok authtoken from $CONFIG_FILE..."
    ngrok config add-authtoken "$AUTHTOKEN"
  else
    echo "Warning: Ngrok authtoken not found in $CONFIG_FILE. Tunnel will start unauthenticated." >&2
  fi
else
  echo "Warning: Config file not found at $CONFIG_FILE. Tunnel will start unauthenticated." >&2
fi

# Start ngrok tunnel and capture output
NGROK_LOG_FILE=$(mktemp)

# Run ngrok in the background
ngrok "$PROTO" "$PORT" > "$NGROK_LOG_FILE" 2>&1 &
NGROK_PID=$!

# Give ngrok a moment to start and establish the tunnel
sleep 5

# Check if ngrok process is still running
if ! ps -p $NGROK_PID > /dev/null; then
  echo "❌ ngrok failed to start." >&2
  cat "$NGROK_LOG_FILE" >&2
  rm "$NGROK_LOG_FILE"
  exit 1
fi

# Try to get the public URL from ngrok's API
PUBLIC_URL=""
for i in {1..10}; do
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
  elif command -v pbcopy &> /dev/null; then
    echo "$PUBLIC_URL" | pbcopy
    echo "(Copied to clipboard ✅)"
  fi
else
  echo "❌ Could not retrieve public URL." >&2
  echo "See logs: $NGROK_LOG_FILE" >&2
fi

# Log the tunnel info
mkdir -p "$HOME/.okastr8"
TUNNEL_LOG="$HOME/.okastr8/tunnel_${NAME}.json"
jq -n --arg name "$NAME" --arg port "$PORT" --arg url "$PUBLIC_URL" \
  '{service: $name, port: $port, url: $url}' > "$TUNNEL_LOG"

# Clean up log file
rm "$NGROK_LOG_FILE"

echo "Press Ctrl+C to stop the tunnel"

# Keep the script running to keep the tunnel alive
wait $NGROK_PID
