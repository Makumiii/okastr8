#!/usr/bin/env bash

# Check if a service name is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <service-name>"
  exit 1
fi

SERVICE_NAME=$1
SERVICE_FILE="/etc/systemd/system/okastr8/${SERVICE_NAME}.service"

echo "Stopping ${SERVICE_NAME}..."
systemctl stop "${SERVICE_NAME}"

echo "Disabling ${SERVICE_NAME}..."
systemctl disable "${SERVICE_FILE}"

echo "Removing service file: ${SERVICE_FILE}..."
rm "${SERVICE_FILE}"

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Service ${SERVICE_NAME} deleted."
