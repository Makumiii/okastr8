#!/usr/bin/env bash
# Creates a systemd unit file from command-line arguments, with optional auto-start.

# --- Root Check ---
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root."
  exit 1
fi

# --- Argument Parsing ---
if [ "$#" -lt 6 ]; then
    echo "Usage: $0 <service_name> <description> <exec_start> <working_directory> <user> <wanted_by> [auto_start:true|false]"
    exit 1
fi

SERVICE_NAME=$1
DESCRIPTION=$2
EXEC_START=$3
WORKING_DIRECTORY=$4
USER=$5
WANTED_BY=$6
AUTO_START=${7:-true}  # Defaults to true if not provided

# --- Unit File Creation ---
UNIT_FILE="/etc/systemd/system/$SERVICE_NAME.service"

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

# --- Reload systemd ---
systemctl daemon-reexec
systemctl daemon-reload

# --- Auto-start Logic ---
if [[ "$AUTO_START" == "true" ]]; then
  systemctl enable "$SERVICE_NAME.service"
  systemctl start "$SERVICE_NAME.service"
  echo "Service '$SERVICE_NAME' enabled and started."
else
  echo "Service '$SERVICE_NAME' created but not started (auto_start=$AUTO_START)."
fi
