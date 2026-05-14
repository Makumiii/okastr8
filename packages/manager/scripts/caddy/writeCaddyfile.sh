#!/usr/bin/env bash
set -eou pipefail

# Writes Caddyfile content safely with proper permissions
# Usage: sudo writeCaddyfile.sh

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

# Read content from stdin
CONTENT=$(cat)

# Write to Caddyfile
CADDYFILE="/etc/caddy/Caddyfile"
echo "$CONTENT" > "$CADDYFILE"

# Ensure correct ownership and permissions
chown root:root "$CADDYFILE"
chmod 644 "$CADDYFILE"

echo "✅ Caddyfile written successfully"
