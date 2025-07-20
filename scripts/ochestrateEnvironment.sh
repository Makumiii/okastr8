#!/usr/bin/env bash
set -eou pipefail

# Check for jq
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed."
  exit 1
fi

# Check if the environment JSON file path is provided
if [ -z "${1:-}" ]; then
  echo "Usage: $0 <path-to-environment-json>"
  exit 1
fi

ENV_JSON_PATH="$1"

# Check if the file exists
if [ ! -f "$ENV_JSON_PATH" ]; then
  echo "Error: Environment JSON file not found at ${ENV_JSON_PATH}"
  exit 1
fi

echo "📄 Reading environment configuration from ${ENV_JSON_PATH}"

# Extract values using jq
CREATE_USER_USERNAME=$(jq -r '.createUser.userName // empty' "$ENV_JSON_PATH")
CREATE_USER_PASSWORD=$(jq -r '.createUser.passWord // empty' "$ENV_JSON_PATH")
CREATE_USER_DISTRO=$(jq -r '.createUser.distro // empty' "$ENV_JSON_PATH")
CHANGE_SSH_PORT_PORT=$(jq -r '.changeSSHPort.port // empty' "$ENV_JSON_PATH")

# Check that all required values were found
if [[ -z "$CREATE_USER_USERNAME" || -z "$CREATE_USER_PASSWORD" || -z "$CREATE_USER_DISTRO" || -z "$CHANGE_SSH_PORT_PORT" ]]; then
  echo "❌ Missing one or more required fields in environment JSON."
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
