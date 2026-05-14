#!/usr/bin/env bash
set -eou pipefail
# Creates a systemd unit file from command-line arguments, with optional auto-start.

# --- Root Check ---
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

# Skip service creation if systemd is not the init system (common in containers).
# We check for /run/systemd/system which exists when systemd is PID 1.
# This is more reliable than `systemctl is-system-running` which can fail on "degraded" systems.
if [ ! -d /run/systemd/system ]; then
  echo "Warning: systemd not running; skipping service creation." >&2
  exit 2
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
OKASTR8_DIR="/etc/systemd/system"
mkdir -p "$OKASTR8_DIR"
UNIT_FILE="$OKASTR8_DIR/$SERVICE_NAME.service"
# Clean up legacy unit path if present.
if [ -f "/etc/systemd/system/okastr8/$SERVICE_NAME.service" ]; then
  rm -f "/etc/systemd/system/okastr8/$SERVICE_NAME.service"
  rmdir /etc/systemd/system/okastr8 2>/dev/null || true
fi

# --- Unit File Creation (Always overwrite/create) ---
echo "Creating/Updating systemd unit file: '$UNIT_FILE'"
HARDENING_BLOCK=""
if [[ "$SERVICE_NAME" == "okastr8-manager" || "$SERVICE_NAME" == "okastr8-webhook" ]]; then
  HARDENING_BLOCK=$(cat <<EOB
# Security hardening (manager/webhook)
UMask=0077
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictSUIDSGID=true
RestrictRealtime=true
SystemCallArchitectures=native
ProtectSystem=full
ProtectHome=read-only
ReadWritePaths=/home/$USER/.okastr8 /tmp /var/tmp
EOB
)
fi

cat > "$UNIT_FILE" << EOL
[Unit]
Description=$DESCRIPTION
Wants=network-online.target docker.service caddy.service cloudflared.service
After=network-online.target docker.service caddy.service cloudflared.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKING_DIRECTORY
Environment="PATH=/home/$USER/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="BUN_INSTALL=/home/$USER/.bun"
# Kill any process using port 41788 before starting (prevents EADDRINUSE)
ExecStartPre=/bin/bash -c 'fuser -k 41788/tcp 2>/dev/null || true'
ExecStart=/bin/bash -c "$EXEC_START" # Wrapped in bash -c
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
$HARDENING_BLOCK

[Install]
WantedBy=$WANTED_BY
EOL

# --- Reload systemd ---
systemctl daemon-reexec
systemctl daemon-reload

# --- Auto-start Logic ---
if [[ "$AUTO_START" == "true" ]]; then
  # Check if service is already enabled/active before trying to enable/start
  if systemctl is-enabled "$SERVICE_NAME.service" &> /dev/null && systemctl is-active "$SERVICE_NAME.service" &> /dev/null; then
    echo "Info: Service '$SERVICE_NAME' is already enabled and active. Skipping enable/start."
  else
    systemctl link "$UNIT_FILE" 2>/dev/null || true # Ignore if already under unit hierarchy.
    systemctl enable "$SERVICE_NAME.service" || true
    systemctl start "$SERVICE_NAME.service"
    echo "Service '$SERVICE_NAME' linked, enabled, and started."
  fi
else
  echo "Service '$SERVICE_NAME' created but not started (auto_start=$AUTO_START)."
fi
