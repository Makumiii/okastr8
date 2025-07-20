#!/usr/bin/env bash
set -eou pipefail

# --- Configuration ---
REPO_URL="https://github.com/Makumiii/okastr8.git"
INSTALL_DIR="$HOME/okastr8"
SYMLINK_DIR="$HOME/.local/bin"
SYMLINK_NAME="okastr8"
SERVICE_NAME="okastr8-webhook"
SERVICE_DESCRIPTION="Okastr8 GitHub Webhook Listener"

# --- Helper Functions ---
info() {
  echo "INFO: $1"
}

error() {
  echo "ERROR: $1" >&2
  exit 1
}

# --- Pre-flight Checks ---
info "Starting Okastr8 installation..."

if [[ $EUID -eq 0 ]]; then
  error "This script should not be run as root. It will use 'sudo' when necessary."
fi

# --- 1. Install Bun ---
info "Checking for Bun..."
if ! command -v bun &> /dev/null; then
  info "Bun not found. Installing..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  info "Bun installed successfully."
else
  info "Bun is already installed."
fi

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
if [ -d "$INSTALL_DIR" ]; then
  info "Directory $INSTALL_DIR already exists. Pulling latest changes."
  cd "$INSTALL_DIR"
  git pull
else
  if ! git clone "$REPO_URL" "$INSTALL_DIR"; then
    error "Failed to clone repository."
  fi
  cd "$INSTALL_DIR"
fi

# --- 4. Install Dependencies ---
info "Installing project dependencies with bun..."
if ! bun install --frozen-lockfile; then
  error "Failed to install dependencies with bun."
fi
info "Dependencies installed."

# --- 5. Create Executable ---
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

# --- 6. Add to PATH ---
info "Checking if $SYMLINK_DIR is in PATH..."
if [[ ":$PATH:" != *":$SYMLINK_DIR:"* ]]; then
  info "$SYMLINK_DIR is not in PATH. Adding it..."
  SHELL_CONFIG_FILE=""

  if [ -n "${BASH_VERSION-}" ]; then
    SHELL_CONFIG_FILE="$HOME/.bashrc"
  elif [ -n "${ZSH_VERSION-}" ]; then
    SHELL_CONFIG_FILE="$HOME/.zshrc"
  else
    SHELL_CONFIG_FILE="$HOME/.profile"
  fi

  if [ -f "$SHELL_CONFIG_FILE" ]; then
    if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$SHELL_CONFIG_FILE"; then
      {
        echo ""
        echo "# Add ~/.local/bin to PATH for user-installed executables"
        echo 'export PATH="$HOME/.local/bin:$PATH"'
      } >> "$SHELL_CONFIG_FILE"
      info "Added PATH export to $SHELL_CONFIG_FILE. Please restart your shell or run: source \"$SHELL_CONFIG_FILE\""
    else
      info "PATH export already exists in $SHELL_CONFIG_FILE."
    fi
  else
    info "Could not find a shell configuration file. Please add $SYMLINK_DIR to your PATH manually."
  fi
else
  info "$SYMLINK_DIR is already in PATH."
fi

# --- 7. Create systemd service ---
info "Creating systemd service..."
BUN_PATH="$(command -v bun)"
SERVICE_EXEC_START="$BUN_PATH run $INSTALL_DIR/src/githubWebHook.ts"
SERVICE_WORKING_DIR="$INSTALL_DIR"
CURRENT_USER="$(whoami)"
CREATE_SCRIPT_PATH="$INSTALL_DIR/scripts/systemd/create.sh"

if [ ! -f "$CREATE_SCRIPT_PATH" ]; then
  error "systemd create script not found at $CREATE_SCRIPT_PATH"
fi

if systemctl list-units --full --all | grep -q "$SERVICE_NAME.service"; then
  info "Systemd service '$SERVICE_NAME' already exists. Skipping creation."
else
  info "Creating systemd service '$SERVICE_NAME'."
  if ! sudo "$CREATE_SCRIPT_PATH" "$SERVICE_NAME" "$SERVICE_DESCRIPTION" "$SERVICE_EXEC_START" "$SERVICE_WORKING_DIR" "$CURRENT_USER" "multi-user.target" "true"; then
    error "Failed to create systemd service."
  fi
  info "Systemd service '$SERVICE_NAME' created and enabled."
fi

info "🎉 Okastr8 installation complete!"
info "Run 'okastr8 --help' to get started."
info "The webhook listener service '$SERVICE_NAME' is running."
info "To check its status, run: systemctl status \"$SERVICE_NAME\""
