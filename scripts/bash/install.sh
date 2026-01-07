#!/usr/bin/env bash
set -eou pipefail

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

if [[ $EUID -eq 0 ]]; then
  error "This script should not be run as root. It will use 'sudo' when necessary."
fi

# Call clean_install at the beginning to ensure a fresh state
clean_install

# --- 1.


# --- 2. Run setup.sh ---
info "Running initial system setup..."
SETUP_SCRIPT_URL="https://raw.githubusercontent.com/Makumiii/okastr8/main/scripts/setup.sh"
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

# --- 8. Create systemd service for GitHub Webhook Listener ---
info "Creating systemd service for GitHub Webhook Listener..."
BUN_PATH="/usr/local/bin/bun"
WEBHOOK_EXEC_START="$BUN_PATH run $INSTALL_DIR/src/githubWebHook.ts"
SERVICE_WORKING_DIR="$INSTALL_DIR"
CURRENT_USER="$(whoami)"
CREATE_SCRIPT_PATH="$INSTALL_DIR/scripts/systemd/create.sh"

if [ ! -f "$CREATE_SCRIPT_PATH" ]; then
  error "systemd create script not found at $CREATE_SCRIPT_PATH"
fi

# Always create/update the service file
info "Creating systemd service '$WEBHOOK_SERVICE_NAME'."
if ! sudo "$CREATE_SCRIPT_PATH" "$WEBHOOK_SERVICE_NAME" "$WEBHOOK_SERVICE_DESCRIPTION" "$WEBHOOK_EXEC_START" "$SERVICE_WORKING_DIR" "$CURRENT_USER" "multi-user.target" "true"; then
  error "Failed to create systemd service for webhook listener."
fi
info "Systemd service '$WEBHOOK_SERVICE_NAME' created and enabled."

# --- 9. Create systemd service for Manager Server ---
info "Creating systemd service for Web Manager Server..."
MANAGER_EXEC_START="$BUN_PATH run $INSTALL_DIR/src/managerServer.ts"

# Always create/update the service file
info "Creating systemd service '$MANAGER_SERVICE_NAME'."
if ! sudo "$CREATE_SCRIPT_PATH" "$MANAGER_SERVICE_NAME" "$MANAGER_SERVICE_DESCRIPTION" "$MANAGER_EXEC_START" "$SERVICE_WORKING_DIR" "$CURRENT_USER" "multi-user.target" "true"; then
  error "Failed to create systemd service for manager server."
fi
info "Systemd service '$MANAGER_SERVICE_NAME' created and enabled."

# --- 10. Start Ngrok Tunnel ---
info "Starting Ngrok tunnel for manager server..."
NGROK_TUNNEL_SCRIPT="$INSTALL_DIR/scripts/tunnel.sh"

if [ ! -f "$NGROK_TUNNEL_SCRIPT" ]; then
  error "Ngrok tunnel script not found at $NGROK_TUNNEL_SCRIPT"
fi

# Run in background so install.sh can complete
"$NGROK_TUNNEL_SCRIPT" &
NGROK_TUNNEL_PID=$!
info "Ngrok tunnel started in background (PID: $NGROK_TUNNEL_PID)."

# --- Done ---
info "🎉 Okastr8 installation complete!"
info "Run 'okastr8 --help' to get started."
info "Webhook listener service '$WEBHOOK_SERVICE_NAME' is running."
info "Web Manager Server service '$MANAGER_SERVICE_NAME' is running."
info "To check status, run: systemctl status \"$WEBHOOK_SERVICE_NAME\" and systemctl status \"$MANAGER_SERVICE_NAME\""
info "Ngrok tunnel is running. Check its output in the background or use 'fg' to bring it to foreground."