set -eou pipefail

# Ensure essential paths are in PATH
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

# --- Error Handling ---
cleanup_on_error() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo ""
    echo "❌ ERROR: Installation failed at line $1." >&2
    echo "Cleaning up partially installed files..." >&2
    
    # Remove newly created user if applicable
    if [[ -n "${USER_CREATED:-}" ]]; then
        echo "🗑️  Removing created user '$USER_CREATED'..." >&2
        userdel -r "$USER_CREATED" || true
    fi

    # Only remove the install dir if it was being created
    if [ -f "$HOME/.okastr8/.installing" ]; then
        rm -rf "$INSTALL_DIR"
        rm -f "$HOME/.okastr8/.installing"
    fi
    exit $exit_code
  fi
}

trap 'cleanup_on_error $LINENO' ERR

# --- Configuration ---
REPO_URL="https://github.com/Makumiii/okastr8.git"
INSTALL_DIR="$HOME/okastr8"
SYMLINK_DIR="$HOME/.local/bin"
SYMLINK_NAME="okastr8"

# Webhook Service
WEBHOOK_SERVICE_NAME="okastr8-webhook"
WEBHOOK_SERVICE_DESCRIPTION="Okastr8 GitHub Webhook Listener"

# Manager Server Service
MANAGER_SERVICE_NAME="okastr8-manager"
MANAGER_SERVICE_DESCRIPTION="Okastr8 Web Manager Server"

CONFIG_DIR="$HOME/.okastr8"
CONFIG_FILE="$CONFIG_DIR/config.json"
DEPLOYMENT_FILE="$CONFIG_DIR/deployment.json"

# Systemd Integration
BUN_PATH="/usr/local/bin/bun"
CREATE_SCRIPT_PATH="$INSTALL_DIR/scripts/systemd/create.sh"
SERVICE_WORKING_DIR="$INSTALL_DIR"
CURRENT_USER=$(whoami)

# Tracking for cleanup
USER_CREATED=""

# --- Helper Functions ---
info() {
  echo "INFO: $1"
}

error() {
  echo "ERROR: $1" >&2
  exit 1
}

# Function to perform a clean removal of existing installation components
clean_install() {
  info "Performing clean installation: Removing existing components..."

  # Stop and remove systemd services
  info "Stopping and removing systemd services if they exist..."
  sudo systemctl stop "$WEBHOOK_SERVICE_NAME" || true
  sudo systemctl disable "$WEBHOOK_SERVICE_NAME" || true
  sudo rm -f "/etc/systemd/system/$WEBHOOK_SERVICE_NAME.service"

  sudo systemctl stop "$MANAGER_SERVICE_NAME" || true
  sudo systemctl disable "$MANAGER_SERVICE_NAME" || true
  sudo rm -f "/etc/systemd/system/$MANAGER_SERVICE_NAME.service"

  info "Reloading systemd daemon..."
  sudo systemctl daemon-reload

  # Remove installed directory
  if [ -d "$INSTALL_DIR" ]; then
    info "Removing existing installation directory: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
  fi

  # Remove symlink
  if [ -L "$SYMLINK_DIR/$SYMLINK_NAME" ]; then
    info "Removing existing symlink: $SYMLINK_DIR/$SYMLINK_NAME"
    rm "$SYMLINK_DIR/$SYMLINK_NAME"
  fi

  # --- 5. Initialize User Config Directory ---
  info "Initializing ~/.okastr8 directory..."
  mkdir -p "$CONFIG_DIR"

  # These files are now always created if they don't exist, or overwritten if clean_install removed them


  if [ ! -f "$CONFIG_FILE" ]; then
    info "creating default config file "
    cat <<EOF > "$CONFIG_FILE"
{
"services": [],
"networking": {
  "ngrok": {
    "authToken": ""
  }
}
}
EOF
   
fi


if [ ! -f "$DEPLOYMENT_FILE" ]; then 
  info "creating defaut config file"
  cat <<EOF > "$DEPLOYMENT_FILE"
{
  "deployments": [],
  
}
EOF
  info "User config initialized in $CONFIG_DIR"
fi

  # Remove user config files (optional, uncomment if you want to reset these too)
  # if [ -f "$CONFIG_FILE" ]; then
  #   info "Removing existing config file: $CONFIG_FILE"
  #   rm "$CONFIG_FILE"
  # fi
  # if [ -f "$DEPLOYMENT_FILE" ]; then
  #   info "Removing existing deployment file: $DEPLOYMENT_FILE"
  #   rm "$DEPLOYMENT_FILE"
  # fi

  info "Clean installation complete."
}

# --- Pre-flight Checks ---
info "Starting Okastr8 installation..."

# --- Root Onboarding ---
if [[ $EUID -eq 0 ]]; then
  echo "🛡️  Okastr8 Security: Running as root is not recommended."
  echo "We will now create a dedicated administrative user and harden your server."
  echo ""

  # 0. Install essential onboarding tools
  info "Installing essential onboarding tools (openssh, sudo)..."
  export DEBIAN_FRONTEND=noninteractive
  if command -v apt-get &> /dev/null; then
    apt-get update -qq && apt-get install -qq -y openssh-client openssh-server sudo
  elif command -v dnf &> /dev/null; then
    dnf install -y openssh-clients openssh-server sudo
  fi
  
  # Verification
  if ! command -v ssh-keygen &> /dev/null; then
    error "Failed to install ssh-keygen. Please install 'openssh-client' manually."
  fi

  # 1. Gather User Details
  while true; do
    read -p "👤 Enter username for new admin (default: okastr8): " NEW_USER < /dev/tty
    NEW_USER=${NEW_USER:-okastr8}
    if [[ "$NEW_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]; then break; fi
    echo "❌ Invalid username. Use lowercase letters, numbers, and underscores."
  done

  while true; do
    read -s -p "🔐 Enter password for $NEW_USER: " NEW_PASS < /dev/tty
    echo ""
    if [[ -n "$NEW_PASS" ]]; then break; fi
    echo "❌ Password cannot be empty."
  done

  # 2. Setup Scripts
  SCRIPTS_URL_BASE="https://raw.githubusercontent.com/Makumiii/okastr8/docker-support/scripts"
  
  info "Downloading setup tools..."
  curl -sSL "$SCRIPTS_URL_BASE/user/create-user.sh?v=$(date +%s)" -o "/tmp/create-user.sh"
  curl -sSL "$SCRIPTS_URL_BASE/ssh/harden-ssh.sh?v=$(date +%s)" -o "/tmp/harden-ssh.sh"
  chmod +x /tmp/create-user.sh /tmp/harden-ssh.sh

  # 3. Create User
  info "Creating user '$NEW_USER'..."
  /tmp/create-user.sh "$NEW_USER" "$NEW_PASS"
  USER_CREATED="$NEW_USER"

  # 4. SSH Key Management
  NEW_USER_HOME=$(eval echo "~$NEW_USER")
  
  # Migrate root keys if they exist
  if [ -f "/root/.ssh/authorized_keys" ]; then
    info "Migrating existing SSH keys to '$NEW_USER'..."
    cat "/root/.ssh/authorized_keys" >> "$NEW_USER_HOME/.ssh/authorized_keys"
    chown "$NEW_USER:$NEW_USER" "$NEW_USER_HOME/.ssh/authorized_keys"
  fi

  # Always generate a fresh Okastr8 key
  info "Generating fresh SSH key for '$NEW_USER'..."
  SSH_KEY_FILE="/tmp/okastr8_admin_key"
  rm -f "$SSH_KEY_FILE"
  ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -N "" -q
  cat "${SSH_KEY_FILE}.pub" >> "$NEW_USER_HOME/.ssh/authorized_keys"
  
  PRIVATE_KEY=$(cat "$SSH_KEY_FILE")
  
  echo ""
  echo "----------------------------------------------------------------"
  echo "🔑 NEW PRIVATE KEY (okastr8_admin.pem)"
  echo "Save this content to a file on your local machine to login."
  echo "----------------------------------------------------------------"
  echo "$PRIVATE_KEY"
  echo "----------------------------------------------------------------"
  
  # Clipboard Injection (OSC 52)
  printf "\033]52;c;$(printf "%s" "$PRIVATE_KEY" | base64 | tr -d '\n')\a"
  echo "💡 Tip: If your terminal supports OSC 52, it's already in your clipboard!"
  echo ""

  while true; do
    read -p "👉 Type 'SAVED' when you have safely stored your key: " CONFIRM < /dev/tty
    if [[ "$CONFIRM" == "SAVED" ]]; then break; fi
  done

  # 5. Lockdown
  info "Locking root account and hardening SSH..."
  passwd -l root
  SKIP_KEY_CHECK=true /tmp/harden-ssh.sh
  
  rm -f "$SSH_KEY_FILE" "${SSH_KEY_FILE}.pub" "/tmp/create-user.sh" "/tmp/harden-ssh.sh"

  echo ""
  info "✅ User created and server hardened."
  echo "Please switch to your new user to finish the installation:"
  echo ""
  echo "   su - $NEW_USER -c 'curl -fsSL https://raw.githubusercontent.com/Makumiii/okastr8/docker-support/scripts/bash/install.sh | bash'"
  echo ""
  exit 0
fi

# Call clean_install at the beginning to ensure a fresh state
clean_install

# Mark installation as in-progress
mkdir -p "$CONFIG_DIR"
touch "$CONFIG_DIR/.installing"

# --- 1.


# --- 2. Run setup.sh ---
info "Running initial system setup..."
SETUP_SCRIPT_URL="https://raw.githubusercontent.com/Makumiii/okastr8/docker-support/scripts/setup.sh"
TEMP_SETUP_SCRIPT="$(mktemp)"
if ! curl -fsSL "$SETUP_SCRIPT_URL" -o "$TEMP_SETUP_SCRIPT"; then
  error "Failed to download setup.sh"
fi
chmod +x "$TEMP_SETUP_SCRIPT"

if ! "$TEMP_SETUP_SCRIPT"; then
  error "setup.sh failed to execute."
fi
rm "$TEMP_SETUP_SCRIPT"
info "Initial system setup complete."

# --- 3. Clone Repository ---
info "Cloning Okastr8 repository into $INSTALL_DIR..."
# This step is now simplified as clean_install handles removal
if ! git clone "$REPO_URL" "$INSTALL_DIR"; then
  error "Failed to clone repository."
fi
cd "$INSTALL_DIR"

# --- 4. Install Dependencies ---
info "Installing project dependencies with bun..."
if ! bun install --frozen-lockfile; then
  error "Failed to install dependencies with bun."
fi
info "Dependencies installed."



# --- 6. Create Executable ---
info "Creating executable in $SYMLINK_DIR..."
mkdir -p "$SYMLINK_DIR"

SYMLINK_PATH="$SYMLINK_DIR/$SYMLINK_NAME"
EXEC_TARGET_PATH="$INSTALL_DIR/src/main.ts"

cat > "$SYMLINK_PATH" <<EOL
#!/usr/bin/env bash
set -euo pipefail
exec bun run "$EXEC_TARGET_PATH" "\$@"
EOL

chmod +x "$SYMLINK_PATH"
info "Executable created at $SYMLINK_PATH"

# --- 7. Add to PATH if Needed ---
info "Checking if $SYMLINK_DIR is in PATH..."
if [[ ":$PATH:" != *":$SYMLINK_DIR:"* ]]; then
  info "$SYMLINK_DIR is not in PATH. Adding it..."
  SHELL_CONFIG_FILE="$HOME/.bashrc"
  if [ -n "${ZSH_VERSION:-}" ]; then
    SHELL_CONFIG_FILE="$HOME/.zshrc"
  fi

  if [ -f "$SHELL_CONFIG_FILE" ]; then
    if ! grep -q 'export PATH="\$HOME/.local/bin:\$PATH"' "$SHELL_CONFIG_FILE"; then
      {
        echo ""
        echo "# Add ~/.local/bin to PATH for Okastr8"
        echo 'export PATH="$HOME/.local/bin:$PATH"'
      } >> "$SHELL_CONFIG_FILE"
      info "Added PATH export to $SHELL_CONFIG_FILE. Please restart your shell or run: source \"$SHELL_CONFIG_FILE\""
    else
      info "PATH already set in $SHELL_CONFIG_FILE."
    fi
  else
    info "Could not find a shell config file. Add $SYMLINK_DIR to PATH manually."
  fi
else
  info "$SYMLINK_DIR is already in PATH."
fi

# --- 8. (Skipped) GitHub Webhook Listener is now integrated into Manager Server


# --- 9. Create systemd service for Manager Server ---
info "Creating systemd service for Web Manager Server..."
MANAGER_EXEC_START="$BUN_PATH run $INSTALL_DIR/src/managerServer.ts"

# Always create/update the service file
info "Creating systemd service '$MANAGER_SERVICE_NAME'."
if ! sudo "$CREATE_SCRIPT_PATH" "$MANAGER_SERVICE_NAME" "$MANAGER_SERVICE_DESCRIPTION" "$MANAGER_EXEC_START" "$SERVICE_WORKING_DIR" "$CURRENT_USER" "multi-user.target" "true"; then
  error "Failed to create systemd service for manager server."
fi
info "Systemd service '$MANAGER_SERVICE_NAME' created and enabled."

# --- 9.5. Configure sudoers for passwordless script execution ---
info "Configuring sudoers for passwordless script execution..."
SUDOERS_SCRIPT="$INSTALL_DIR/scripts/setup-sudoers.sh"
if [ -f "$SUDOERS_SCRIPT" ]; then
  if sudo "$SUDOERS_SCRIPT"; then
    info "Sudoers configuration complete."
  else
    info "Warning: Sudoers configuration failed. Some features may require password prompts."
  fi
else
  info "Warning: setup-sudoers.sh not found. Skipping sudoers configuration."
fi

# --- 10. Start Cloudflare Tunnel (Optional/Manual) ---
# We no longer auto-start tunnels. The user should run 'okastr8 tunnel setup <token>'

# --- Done ---
rm -f "$CONFIG_DIR/.installing"
info "🎉 Okastr8 installation complete!"
info "Run 'okastr8 --help' to get started."
info "Run 'okastr8 setup full' to initialize your system."

info "Web Manager Server service '$MANAGER_SERVICE_NAME' is running."
info "To check status, run: systemctl status \"$MANAGER_SERVICE_NAME\""