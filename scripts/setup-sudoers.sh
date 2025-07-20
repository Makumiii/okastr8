#!/usr/bin/env bash
set -eou pipefail

# This script configures sudoers to allow the current user to run specific
# okastr8 shell scripts without a password prompt. This is necessary for the
# Bun/Hono server to execute system commands non-interactively.
#
# WARNING: This grants passwordless sudo access for these specific commands.
# Review the commands carefully before running this script.

# Check for root privileges
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root. Please use: sudo ./setup-sudoers.sh" >&2
  exit 1
fi

# Get the user who invoked sudo (the user who will run the Bun server)
TARGET_USER=${SUDO_USER:-$(whoami)}

# Determine the absolute path to the okastr8 project root
# This script is located in scripts/, so we go up one level.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

if [ -z "$PROJECT_ROOT" ]; then
  echo "Error: Could not determine project root." >&2
  exit 1
}

SUDOERS_FILE="/etc/sudoers.d/okastr8-bun-server"

# List of scripts that require NOPASSWD access
# These paths are relative to the PROJECT_ROOT
SCRIPTS=(
  "scripts/user/create-user.sh"
  "scripts/user/delete-user.sh"
  "scripts/user/lockUser.sh"
  "scripts/user/lastLogin.sh"
  "scripts/user/listGroups.sh"
  "scripts/user/listUsers.sh"
  "scripts/user/switch-user.sh"
  "scripts/systemd/create.sh"
  "scripts/systemd/delete.sh"
  "scripts/systemd/start.sh"
  "scripts/systemd/stop.sh"
  "scripts/systemd/restart.sh"
  "scripts/systemd/status.sh"
  "scripts/systemd/logs.sh"
  "scripts/systemd/enable.sh"
  "scripts/systemd/disable.sh"
  "scripts/systemd/reload.sh"
  "scripts/systemd/list.sh"
  "scripts/ochestrateEnvironment.sh"
  "scripts/setup.sh"
  "scripts/ufw/defaults.sh"
  "scripts/fail2ban/fail2ban.sh"
  "scripts/ssh/change-ssh-port.sh"
)

echo "Configuring sudoers for user: $TARGET_USER"
echo "Project root: $PROJECT_ROOT"

# Create the sudoers file content
SUDOERS_CONTENT="# Allow $TARGET_USER to run specific okastr8 scripts without password
"
for SCRIPT in "${SCRIPTS[@]}"; do
  FULL_SCRIPT_PATH="$PROJECT_ROOT/$SCRIPT"
  if [ -f "$FULL_SCRIPT_PATH" ]; then
    SUDOERS_CONTENT+="$TARGET_USER ALL=(ALL) NOPASSWD: $FULL_SCRIPT_PATH\n"
    echo "  - Added: $FULL_SCRIPT_PATH"
  else
    echo "Warning: Script not found, skipping: $FULL_SCRIPT_PATH" >&2
  fi
done

# Write the content to the sudoers.d file
echo -e "$SUDOERS_CONTENT" | tee "$SUDOERS_FILE" > /dev/null

# Set secure permissions for the sudoers file
chmod 0440 "$SUDOERS_FILE"

echo "Sudoers configuration complete. File created at $SUDOERS_FILE"
echo "You can review its content with: sudo cat $SUDOERS_FILE"
echo "To remove this configuration, delete the file: sudo rm $SUDOERS_FILE"
