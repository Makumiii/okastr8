#!/usr/bin/env bash

if [ -z "$1" ]; then
  echo "Usage: $0 <service-name>"
  exit 1
fi

SERVICE_NAME=$1
SERVICE_FILE="/etc/systemd/system/okastr8/${SERVICE_NAME}.service"

if [ ! -f "$SERVICE_FILE" ]; then
  echo "Error: Service file not found at ${SERVICE_FILE}"
  exit 1
fi

echo "Last 50 log lines for service ${SERVICE_NAME}:"
journalctl -u "${SERVICE_NAME}" -n 50
