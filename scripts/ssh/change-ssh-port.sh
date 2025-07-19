#!/usr/bin/env bash
# Changes the SSH port in /etc/ssh/sshd_config

if [ -z "$1" ]; then
  echo "Usage: $0 <port>"
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root."
  exit 1
fi

PORT=$1

# Validate that the port is a number
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    echo "Error: Port must be a number."
    exit 1
fi

# Validate that the port is in the valid range
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo "Error: Port must be between 1 and 65535."
    exit 1
fi

# Backup the original sshd_config file
if [ -f /etc/ssh/sshd_config ]; then
  cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
else
  echo "Error: /etc/ssh/sshd_config not found."
  exit 1
fi

# Change the port
sed -i "s/^\s*#\?\s*Port .*/Port $PORT/" /etc/ssh/sshd_config

# Restart the SSH service to apply changes
if command -v systemctl &> /dev/null; then
    systemctl restart sshd
elif command -v service &> /dev/null; then
    service ssh restart
else
    echo "Could not restart SSH service. Please restart it manually."
fi

echo "✅ SSH port has been changed to $PORT."
echo "⚠️ Make sure to update your firewall rules to allow traffic on port $PORT!"
