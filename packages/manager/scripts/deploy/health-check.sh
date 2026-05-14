#!/usr/bin/env bash
set -eou pipefail

# Health check script for services
# Usage: health-check.sh <method> <target> [timeout_seconds]
# Methods: http, process, port, command
#
# Examples:
#   health-check.sh http http://localhost:3000/health 10
#   health-check.sh process my-app
#   health-check.sh port 3000
#   health-check.sh command "curl -s localhost:3000"

if [ -z "${1:-}" ] || [ -z "${2:-}" ]; then
  echo "Usage: $0 <method> <target> [timeout_seconds]"
  echo "Methods: http, process, port, command"
  exit 1
fi

METHOD="$1"
TARGET="$2"
TIMEOUT="${3:-30}"

echo "🏥 Running health check: $METHOD -> $TARGET (timeout: ${TIMEOUT}s)"

case "$METHOD" in
  http)
    # HTTP health check - expects 2xx response
    echo "  Checking HTTP endpoint..."
    
    for ((i=1; i<=TIMEOUT; i++)); do
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET" 2>/dev/null || echo "000")
      
      if [[ "$HTTP_CODE" =~ ^2[0-9]{2}$ ]]; then
        echo "  ✅ HTTP check passed (status: $HTTP_CODE)"
        exit 0
      fi
      
      if [ $i -lt $TIMEOUT ]; then
        sleep 1
      fi
    done
    
    echo "  ❌ HTTP check failed after ${TIMEOUT}s (last status: $HTTP_CODE)"
    exit 1
    ;;
    
  process)
    # Check if a process is running
    echo "  Checking process..."
    
    for ((i=1; i<=TIMEOUT; i++)); do
      if pgrep -f "$TARGET" > /dev/null 2>&1; then
        PID=$(pgrep -f "$TARGET" | head -1)
        echo "  ✅ Process '$TARGET' is running (PID: $PID)"
        exit 0
      fi
      
      if [ $i -lt $TIMEOUT ]; then
        sleep 1
      fi
    done
    
    echo "  ❌ Process '$TARGET' not found after ${TIMEOUT}s"
    exit 1
    ;;
    
  port)
    # Check if a port is listening
    echo "  Checking port $TARGET..."
    
    for ((i=1; i<=TIMEOUT; i++)); do
      if command -v ss &> /dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ":$TARGET "; then
          echo "  ✅ Port $TARGET is listening"
          exit 0
        fi
      elif command -v netstat &> /dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":$TARGET "; then
          echo "  ✅ Port $TARGET is listening"
          exit 0
        fi
      else
        # Fallback: try to connect
        if timeout 1 bash -c "cat < /dev/null > /dev/tcp/localhost/$TARGET" 2>/dev/null; then
          echo "  ✅ Port $TARGET is accepting connections"
          exit 0
        fi
      fi
      
      if [ $i -lt $TIMEOUT ]; then
        sleep 1
      fi
    done
    
    echo "  ❌ Port $TARGET not listening after ${TIMEOUT}s"
    exit 1
    ;;
    
  command)
    # Run a custom command - exit 0 = success
    echo "  Running custom command..."
    
    for ((i=1; i<=TIMEOUT; i++)); do
      if bash -c "$TARGET" > /dev/null 2>&1; then
        echo "  ✅ Command succeeded"
        exit 0
      fi
      
      if [ $i -lt $TIMEOUT ]; then
        sleep 1
      fi
    done
    
    echo "  ❌ Command failed after ${TIMEOUT}s"
    exit 1
    ;;
    
  *)
    echo "❌ Unknown method: $METHOD"
    echo "Supported methods: http, process, port, command"
    exit 1
    ;;
esac
