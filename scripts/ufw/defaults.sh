#!/usr/bin/env bash
set -eou pipefail

# This script must be run as root
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root."
  exit 1
fi

# Get the desired port from argument or default to 2222
NEW_SSH_PORT=${1:-2222}

# --- UFW Configuration ---
ufw --force reset

ufw default deny incoming
ufw default allow outgoing

ufw allow "$NEW_SSH_PORT"/tcp  # SSH
ufw allow 80/tcp               # HTTP
ufw allow 443/tcp              # HTTPS

ufw enable

echo "✅ UFW configured. Allowed ports: $NEW_SSH_PORT (SSH), 80, 443"

# --- SSH Port Configuration ---
SCRIPT_DIR=$(dirname -- "$(readlink -f -- "$0")")
"$SCRIPT_DIR/../ssh/change-ssh-port.sh" "$NEW_SSH_PORT"
