#!/usr/bin/env bash
set -eo pipefail

# Ensure essential paths are in PATH
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# SSH Hardening Script
# This script hardens SSH configuration with SAFETY CHECKS to prevent lockouts
# 
# Features:
# - Disables password authentication (SSH keys only)
# - Disables root login  
# - Optionally changes SSH port
# - VALIDATES config before applying (sshd -t)
# - Creates backup of original config
# - Tests new config BEFORE restarting SSH

if [[ $EUID -ne 0 ]]; then
  echo "❌ This script must be run as root." >&2
  exit 1
fi

# Configuration
SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_CONFIG_BACKUP="/etc/ssh/sshd_config.backup.$(date +%Y%m%d_%H%M%S)"
NEW_SSH_PORT="${1:-}"  # Optional: pass port as argument

# --- Pre-flight Checks ---
echo "🔍 Running pre-flight checks..."

# Check if sshd is installed (with fallback for minimal environments)
if ! command -v sshd &> /dev/null && [ ! -x /usr/sbin/sshd ]; then
  echo "❌ OpenSSH server (sshd) is not installed." >&2
  exit 1
fi

# Use explicit path if found in sbin
SSHD_BIN=$(command -v sshd || echo "/usr/sbin/sshd")

# Check if config file exists
if [ ! -f "$SSHD_CONFIG" ]; then
  echo "❌ SSH config file not found at $SSHD_CONFIG" >&2
  exit 1
fi

# Check if at least one SSH key exists for the current user (or calling user)
# Check if at least one SSH key exists for the current user (or calling user)
# We allow skipping this check if we are in an automated flow where we know a key was just created for another user.
if [ "${SKIP_KEY_CHECK:-false}" = "true" ]; then
  echo "⏩ Skipping SSH key check (SKIP_KEY_CHECK=true)"
else
  CALLING_USER=$(whoami)
  CALLING_USER_HOME=$(eval echo "~$CALLING_USER")
  AUTHORIZED_KEYS="$CALLING_USER_HOME/.ssh/authorized_keys"

  if [ ! -f "$AUTHORIZED_KEYS" ] || [ ! -s "$AUTHORIZED_KEYS" ]; then
    echo "⚠️  WARNING: No SSH authorized_keys found for user '$CALLING_USER'" >&2
    echo "   If you disable password auth without SSH keys, you may be locked out!" >&2
    read -p "   Continue anyway? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
      echo "Aborted."
      exit 1
    fi
  fi
fi

# --- Backup Original Config ---
echo "📦 Backing up SSH config to $SSHD_CONFIG_BACKUP"
cp "$SSHD_CONFIG" "$SSHD_CONFIG_BACKUP"

# --- Apply Hardening Settings ---
echo "🔧 Applying SSH hardening settings..."

# Function to set a config option (uncomment if commented, set value)
set_ssh_option() {
  local option="$1"
  local value="$2"
  
  if grep -qE "^\s*#?\s*$option\s+" "$SSHD_CONFIG"; then
    # Option exists (possibly commented), replace it
    sed -i "s/^\s*#\?\s*$option\s.*/$option $value/" "$SSHD_CONFIG"
  else
    # Option doesn't exist, append it
    echo "$option $value" >> "$SSHD_CONFIG"
  fi
  echo "  ✓ $option $value"
}

# Disable password authentication
set_ssh_option "PasswordAuthentication" "no"
set_ssh_option "ChallengeResponseAuthentication" "no"
set_ssh_option "UsePAM" "no"

# Disable root login
set_ssh_option "PermitRootLogin" "no"

# Disable empty passwords
set_ssh_option "PermitEmptyPasswords" "no"

# Use only SSH protocol 2 (usually default but be explicit)
set_ssh_option "Protocol" "2"

# Limit authentication attempts
set_ssh_option "MaxAuthTries" "3"

# Disable X11 forwarding (unless needed)
set_ssh_option "X11Forwarding" "no"

# Change SSH port if specified
if [ -n "$NEW_SSH_PORT" ]; then
  # Validate port is a number in valid range
  if ! [[ "$NEW_SSH_PORT" =~ ^[0-9]+$ ]] || [ "$NEW_SSH_PORT" -lt 1 ] || [ "$NEW_SSH_PORT" -gt 65535 ]; then
    echo "❌ Invalid port number: $NEW_SSH_PORT" >&2
    cp "$SSHD_CONFIG_BACKUP" "$SSHD_CONFIG"
    exit 1
  fi
  set_ssh_option "Port" "$NEW_SSH_PORT"
fi

# --- CRITICAL: Validate Config Before Applying ---
echo ""
echo "🔍 Validating SSH configuration..."

# Fix for minimal containers: ensure privilege separation directory exists
if [ ! -d "/run/sshd" ]; then
    echo "🛠️  Creating missing privilege separation directory: /run/sshd"
    mkdir -p /run/sshd
    chmod 0755 /run/sshd
fi

if ! "$SSHD_BIN" -t -f "$SSHD_CONFIG"; then
  echo "❌ SSH configuration validation FAILED!" >&2
  echo "   Restoring backup..." >&2
  cp "$SSHD_CONFIG_BACKUP" "$SSHD_CONFIG"
  echo "   Original config restored. No changes applied." >&2
  exit 1
fi
echo "✅ SSH configuration is valid."

# --- Restart SSH Service ---
echo ""
echo "🔄 Restarting SSH service..."

# Detect init system and restart appropriately
if command -v systemctl &> /dev/null; then
  systemctl restart sshd || systemctl restart ssh || true
elif command -v service &> /dev/null; then
  service sshd restart || service ssh restart || true
else
  echo "⚠️  Could not restart SSH service. Please restart manually." >&2
fi

echo ""
echo "✅ SSH hardening complete!"
echo ""
echo "Applied settings:"
echo "  • Password authentication: DISABLED"
echo "  • Root login: DISABLED"
echo "  • Empty passwords: DISABLED"
echo "  • Max auth tries: 3"
echo "  • X11 forwarding: DISABLED"
if [ -n "$NEW_SSH_PORT" ]; then
  echo "  • SSH port: $NEW_SSH_PORT"
  echo ""
  echo "⚠️  Don't forget to update your firewall to allow port $NEW_SSH_PORT!"
fi
echo ""
echo "📁 Backup saved to: $SSHD_CONFIG_BACKUP"
echo ""
echo "🔐 Make sure you have SSH key access before closing this session!"
