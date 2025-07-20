#!/usr/bin/env bash
set -eou pipefail
# Creates a systemd unit file from command-line arguments, with optional auto-start.

# --- Root Check ---
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

# --- Argument Parsing ---
if [ "$#" -lt 6 ]; then
    echo "Usage: $0 <service_name> <description> <exec_start> <working_directory> <user> <wanted_by> [auto_start:true|false]" >&2
    exit 1
fi

SERVICE_NAME=$1
DESCRIPTION=$2
EXEC_START=$3
WORKING_DIRECTORY=$4
USER=$5
WANTED_BY=$6
AUTO_START=${7:-true}  # Defaults to true if not provided

# --- Unit File Path ---
OKASTR8_DIR="/etc/systemd/system/okastr8"
mkdir -p "$OKASTR8_DIR"
UNIT_FILE="$OKASTR8_DIR/$SERVICE_NAME.service"

# --- Check if Unit File Already Exists ---
if [ -f "$UNIT_FILE" ]; then
  echo "Info: Systemd unit file '$UNIT_FILE' already exists. Skipping creation." >&2
  # Proceed to link/enable/start if auto_start is true, as the file might exist but not be enabled
else
  # --- Unit File Creation ---
  cat > "$UNIT_FILE" << EOL
[Unit]
Description=$DESCRIPTION
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKING_DIRECTORY
ExecStart=$EXEC_START
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=$WANTED_BY
EOL

  echo "Systemd unit file '$UNIT_FILE' created."
fi

# --- Reload systemd ---
systemctl daemon-reexec
systemctl daemon-reload

# --- Auto-start Logic ---
if [[ "$AUTO_START" == "true" ]]; then
  # Check if service is already enabled/active before trying to enable/start
  if systemctl is-enabled "$SERVICE_NAME.service" &> /dev/null && systemctl is-active "$SERVICE_NAME.service" &> /dev/null; then
    echo "Info: Service '$SERVICE_NAME' is already enabled and active. Skipping enable/start."
  else
    systemctl link "$UNIT_FILE" || true # Link might fail if already linked, use || true
    systemctl enable "$SERVICE_NAME.service"
    systemctl start "$SERVICE_NAME.service"
    echo "Service '$SERVICE_NAME' linked, enabled, and started."
  fi
else
  echo "Service '$SERVICE_NAME' created but not started (auto_start=$AUTO_START)."
fi