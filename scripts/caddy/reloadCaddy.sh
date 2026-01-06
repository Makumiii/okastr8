#!/usr/bin/env bash
set -eou pipefail

# Reloads Caddy to apply new Caddyfile configuration
# Uses graceful reload - no dropped connections

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

# Check if Caddy is installed
if ! command -v caddy &> /dev/null; then
  echo "❌ Caddy is not installed." >&2
  exit 1
fi

# Validate Caddyfile before reloading
CADDYFILE="/etc/caddy/Caddyfile"
if [ -f "$CADDYFILE" ]; then
  echo "🔍 Validating Caddyfile..."
  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile 2>/dev/null; then
    echo "❌ Caddyfile validation failed. Not reloading." >&2
    exit 1
  fi
  echo "✅ Caddyfile is valid."
fi

# Reload Caddy (graceful - no dropped connections)
echo "🔄 Reloading Caddy..."
if systemctl is-active --quiet caddy; then
  systemctl reload caddy || systemctl restart caddy
  echo "✅ Caddy reloaded successfully."
else
  echo "⚠️  Caddy is not running. Starting it..."
  systemctl start caddy
  echo "✅ Caddy started."
fi
