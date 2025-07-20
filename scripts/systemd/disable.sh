#!/usr/bin/env bash
set -eou pipefail

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

echo "Disabling service ${SERVICE_NAME}..."
systemctl disable "${SERVICE_NAME}"
echo "Service ${SERVICE_NAME} disabled."
