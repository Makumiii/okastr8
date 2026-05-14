#!/usr/bin/env bash
set -eou pipefail

# Check for bun
if ! command -v bun &> /dev/null; then
  echo "Error: bun is required but not installed." >&2
  exit 1
fi

SCRIPT_DIR="$(dirname "$0")"
READ_CONFIG="$SCRIPT_DIR/read_config.ts"

# Extract values using bun script
CREATE_USER_USERNAME=$(bun "$READ_CONFIG" setup.user.username)
CREATE_USER_PASSWORD=$(bun "$READ_CONFIG" setup.user.password)
CREATE_USER_DISTRO=$(bun "$READ_CONFIG" setup.user.distro)
CHANGE_SSH_PORT_PORT=$(bun "$READ_CONFIG" setup.ssh.port)

# Check that all required values were found
if [[ -z "$CREATE_USER_USERNAME" || -z "$CREATE_USER_PASSWORD" || -z "$CREATE_USER_DISTRO" || -z "$CHANGE_SSH_PORT_PORT" ]]; then
  echo "❌ Missing one or more required fields in environment JSON." >&2
  exit 1
fi

# Display extracted values
echo "✅ Extracted Configuration:"
echo "  Create User Username: $CREATE_USER_USERNAME"
echo "  Create User Password: (hidden)"
echo "  Create User Distro:   $CREATE_USER_DISTRO"
echo "  Change SSH Port:      $CHANGE_SSH_PORT_PORT"

SCRIPT_DIR="$(dirname "$0")"

# Run setup
echo "🚀 Running setup.sh..."
"$SCRIPT_DIR/setup.sh"

# Create user
echo "👤 Creating user..."
"$SCRIPT_DIR/user/create-user.sh" "$CREATE_USER_USERNAME" "$CREATE_USER_PASSWORD" "$CREATE_USER_DISTRO"

# UFW and SSH Port
echo "🧱 Configuring UFW defaults and SSH port..."
"$SCRIPT_DIR/ufw/defaults.sh" "$CHANGE_SSH_PORT_PORT"

# Fail2Ban setup
echo "🔒 Configuring Fail2Ban..."
"$SCRIPT_DIR/fail2ban/fail2ban.sh"

echo "✅ Server hardening complete."