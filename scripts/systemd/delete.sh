#!/usr/bin/env bash
set -eou pipefail

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
systemctl disable "${SERVICE_NAME}"

echo "Unlinking ${SERVICE_NAME}..."
systemctl reset-failed "${SERVICE_NAME}"  # Optional: clears failed state
systemctl disable --now "${SERVICE_NAME}" 2>/dev/null  # Just in case
systemctl reenable "${SERVICE_FILE}" 2>/dev/null       # Force cleanup

echo "Removing service file: ${SERVICE_FILE}..."
rm -f "${SERVICE_FILE}"

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Service ${SERVICE_NAME} deleted."
