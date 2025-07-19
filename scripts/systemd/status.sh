#!/usr/bin/env bash

# Check if a service name is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <service-name>" >&2
  exit 1
fi

SERVICE_NAME="$1"
SERVICE_FILE="/etc/systemd/system/okastr8/${SERVICE_NAME}.service"

# Check if the service file exists
if [ ! -f "$SERVICE_FILE" ]; then
  echo "Error: Service file not found at ${SERVICE_FILE}" >&2
  exit 4
fi

# Check if the service is active (running)
if systemctl is-active --quiet "$SERVICE_NAME"; then
  exit 0
fi

# Check if the service has failed
if systemctl is-failed --quiet "$SERVICE_NAME"; then
  exit 2
fi

# If not active and not failed, it's considered not running
exit 3