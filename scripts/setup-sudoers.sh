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
fi

SUDOERS_FILE="/etc/sudoers.d/okastr8-sudoers"

# List of scripts that require NOPASSWD access
# These paths are relative to the PROJECT_ROOT
# IMPORTANT: Keep this list in sync with all scripts the app uses!
SCRIPTS=(
  # User management
  "scripts/user/create-user.sh"
  "scripts/user/delete-user.sh"
  "scripts/user/lockUser.sh"
  "scripts/user/unlockUser.sh"
  "scripts/user/lastLogin.sh"
  "scripts/user/listGroups.sh"
  "scripts/user/listUsers.sh"
  "scripts/user/switch-user.sh"
  
  # Systemd service management
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
  
  # Setup and orchestration
  "scripts/ochestrateEnvironment.sh"
  "scripts/setup.sh"
  "scripts/setup-sudoers.sh"
  "scripts/setup-ssh-deploy.sh"
  
  # Security
  "scripts/ufw/defaults.sh"
  "scripts/fail2ban/fail2ban.sh"
  "scripts/ssh/change-ssh-port.sh"
  "scripts/ssh/harden-ssh.sh"
  
  # Git operations
  "scripts/git/pull.sh"
  "scripts/git/rollback.sh"
  
  # Deploy
  "scripts/deploy.sh"
  "scripts/deploy/health-check.sh"
  
  # Caddy/reverse proxy
  "scripts/caddy/reloadCaddy.sh"
  "scripts/caddy/writeCaddyfile.sh"
  
  # Tunnels
  "scripts/tunnel.sh"
)

# Additional system commands to allow without password
COMMANDS=(
  "/usr/bin/docker"
  "/usr/bin/docker-compose"
  "/usr/local/bin/docker"
  "/usr/local/bin/docker-compose"
  "/usr/local/lib/docker/cli-plugins/docker-compose"
)

echo "Configuring sudoers for user: $TARGET_USER"
echo "Project root: $PROJECT_ROOT"

# Create the sudoers file content
SUDOERS_CONTENT="# Allow $TARGET_USER to run specific okastr8 scripts without password
"
for SCRIPT in "${SCRIPTS[@]}"; do
  FULL_SCRIPT_PATH="$PROJECT_ROOT/$SCRIPT"
  if [ -f "$FULL_SCRIPT_PATH" ]; then
    SUDOERS_CONTENT+="$TARGET_USER ALL=(root) NOPASSWD: $FULL_SCRIPT_PATH\n"
    echo "  - Added: $FULL_SCRIPT_PATH"
  else
    echo "Warning: Script not found, skipping: $FULL_SCRIPT_PATH" >&2
  fi
done

# Add system commands (like docker)
echo ""
echo "Adding system commands..."
for CMD in "${COMMANDS[@]}"; do
  SUDOERS_CONTENT+="$TARGET_USER ALL=(root) NOPASSWD: $CMD *\n"
  echo "  - Added: $CMD"
done

# Write the content to the sudoers.d file
echo -e "$SUDOERS_CONTENT" | tee "$SUDOERS_FILE" > /dev/null

# Set secure permissions for the sudoers file
chmod 0440 "$SUDOERS_FILE"

echo "Sudoers configuration complete. File created at $SUDOERS_FILE"
echo "You can review its content with: sudo cat $SUDOERS_FILE"
echo "To remove this configuration, delete the file: sudo rm $SUDOERS_FILE"

# --- SELinux Configuration ---
if command -v sestatus >/dev/null 2>&1; then
    CURRENT_MODE=$(getenforce)
    if [ "$CURRENT_MODE" != "Disabled" ]; then
        echo "----------------------------------------------------------------"
        echo "SELinux detected (Mode: $CURRENT_MODE). Configuring permissions..."
        
        # Check for semanage
        if ! command -v semanage >/dev/null 2>&1; then
            echo "⚠️  Warning: 'semanage' command not found."
            echo "   Please install 'policycoreutils-python-utils' (Fedora/CentOS/RHEL) to configure SELinux contexts."
            echo "   Skipping SELinux configuration."
        else
            # Get target user's home directory securely
            USER_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)
            OKASTR8_DIR="$USER_HOME/.okastr8"
            
            # Create directory if it doesn't exist (to apply rules effectively)
            if [ ! -d "$OKASTR8_DIR" ]; then
                mkdir -p "$OKASTR8_DIR"
                chown "$TARGET_USER:$TARGET_USER" "$OKASTR8_DIR"
            fi

            # Add rule: Treat .okastr8 content as binaries/executables (bin_t)
            # This allows systemd services to execute them.
            echo "Adding SELinux context rule for $OKASTR8_DIR..."
            semanage fcontext -a -t bin_t "$OKASTR8_DIR(/.*)?" 2>/dev/null || \
            semanage fcontext -m -t bin_t "$OKASTR8_DIR(/.*)?" 
            
            # Apply context
            echo "Applying SELinux contexts..."
            restorecon -Rv "$OKASTR8_DIR"
            
            echo "✅ SELinux configuration complete."
        fi
    fi
fi
