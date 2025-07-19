#!/usr/bin/env bash
# Configures and restarts fail2ban with a custom SSH port.

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root."
  exit 1
fi

SCRIPT_DIR=$(dirname -- "$(readlink -f -- "$0")")

# Source the defaults file from the ufw directory to get the new SSH port
UFW_DEFAULTS_PATH="$SCRIPT_DIR/../ufw/defaults.sh"

if [ -f "$UFW_DEFAULTS_PATH" ]; then
    source "$UFW_DEFAULTS_PATH"
else
    echo "Error: defaults.sh not found in the ufw directory."
    exit 1
fi

# Check if NEW_SSH_PORT is set
if [ -z "$NEW_SSH_PORT" ]; then
    echo "Error: NEW_SSH_PORT is not set in defaults.sh."
    exit 1
fi

# Validate the port value
if ! [[ "$NEW_SSH_PORT" =~ ^[0-9]+$ ]] || [ "$NEW_SSH_PORT" -lt 1 ] || [ "$NEW_SSH_PORT" -gt 65535 ]; then
    echo "Error: NEW_SSH_PORT is not a valid port number."
    exit 1
fi

# Check if the template file exists
if [ ! -f "$SCRIPT_DIR/jail.local" ]; then
    echo "Error: jail.local template not found."
    exit 1
fi

# Create the destination directory if it doesn't exist
mkdir -p /etc/fail2ban/jail.d

# Backup existing config file, if it exists
if [ -f "/etc/fail2ban/jail.d/sshd.local" ]; then
    cp /etc/fail2ban/jail.d/sshd.local /etc/fail2ban/jail.d/sshd.local.bak 2>/dev/null
fi

# Replace the placeholder and create the new config file
sed "s/__SSH_PORT__/$NEW_SSH_PORT/g" "$SCRIPT_DIR/jail.local" > /etc/fail2ban/jail.d/sshd.local

echo "Fail2ban configuration updated with SSH port $NEW_SSH_PORT."

# Restart fail2ban to apply changes
if command -v systemctl &> /dev/null; then
    systemctl restart fail2ban
elif command -v service &> /dev/null; then
    service fail2ban restart
else
    echo "Could not restart fail2ban service. Please restart it manually."
fi

echo "Fail2ban service restarted."
