#!/usr/bin/env bash
set -eou pipefail

# This script must be run as root
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root."
  exit 1
fi

# Define SCRIPT_DIR first (was bug: used before defined)
SCRIPT_DIR=$(dirname -- "$(readlink -f -- "$0")")

# Get the desired port from argument or default to 2222
NEW_SSH_PORT=${1:-2222}

# --- UFW Configuration ---
# Configure firewall FIRST to allow new port before changing SSH
# (prevents lockout if SSH changes before firewall allows new port)
echo "🔧 Configuring UFW..."
ufw --force reset

ufw default deny incoming
ufw default allow outgoing

ufw allow "$NEW_SSH_PORT"/tcp  # SSH (new port)
ufw allow 80/tcp               # HTTP
ufw allow 443/tcp              # HTTPS

ufw --force enable

echo "✅ UFW configured. Allowed ports: $NEW_SSH_PORT (SSH), 80, 443"

# --- SSH Port Configuration ---
# Change SSH port AFTER firewall allows it (safe order)
echo "🔧 Changing SSH port..."
"$SCRIPT_DIR/../ssh/change-ssh-port.sh" "$NEW_SSH_PORT"

echo "✅ SSH port changed to $NEW_SSH_PORT"
