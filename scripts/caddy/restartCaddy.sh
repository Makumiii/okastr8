#!/usr/bin/env bash
set -eou pipefail

# Check for root privileges
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

echo "Restarting Caddy service..."
systemctl restart caddy || { echo "Error: Failed to restart Caddy service." >&2; exit 1; }

echo "Caddy service restarted successfully."
