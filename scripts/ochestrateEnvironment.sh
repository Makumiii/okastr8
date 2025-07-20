#!/usr/bin/env bash
set -eou pipefail

# Check if the environment JSON file path is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-environment-json>"
  exit 1
fi

ENV_JSON_PATH="$1"

# Check if the file exists
if [ ! -f "$ENV_JSON_PATH" ]; then
  echo "Error: Environment JSON file not found at ${ENV_JSON_PATH}"
  exit 1
fi

echo "Reading environment configuration from ${ENV_JSON_PATH}"

# Extract values using jq
CREATE_USER_USERNAME=$(jq -r '.createUser.userName // ""' "$ENV_JSON_PATH")
CREATE_USER_PASSWORD=$(jq -r '.createUser.passWord // ""' "$ENV_JSON_PATH")
CREATE_USER_DISTRO=$(jq -r '.createUser.distro // ""' "$ENV_JSON_PATH")
CHANGE_SSH_PORT_PORT=$(jq -r '.changeSSHPort.port // ""' "$ENV_JSON_PATH")

# Display extracted values (for verification)
echo "Extracted Configuration:"
echo "  Create User Username: ${CREATE_USER_USERNAME}"
echo "  Create User Password: ${CREATE_USER_PASSWORD}"
echo "  Create User Distro: ${CREATE_USER_DISTRO}"
echo "  Change SSH Port: ${CHANGE_SSH_PORT_PORT}"

# Call other scripts
echo "Running setup.sh..."
"$(dirname "$0")"/setup.sh

echo "Creating user..."
"$(dirname "$0")"/user/create-user.sh "$CREATE_USER_USERNAME" "$CREATE_USER_PASSWORD" "$CREATE_USER_DISTRO"

echo "Configuring UFW defaults and SSH port..."
"$(dirname "$0")"/ufw/defaults.sh "$CHANGE_SSH_PORT_PORT"

echo "Configuring Fail2Ban..."
"$(dirname "$0")"/fail2ban/fail2ban.sh
