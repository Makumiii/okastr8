#!/usr/bin/env bash
set -eou pipefail

# --- Config ---
USE_FEDORA=${USE_FEDORA:-false}
CONFIG_FILE="$HOME/.okastr8/config.json"

# --- Detect OS ---
if [[ "$USE_FEDORA" != true ]]; then
  if grep -qi fedora /etc/os-release; then
    USE_FEDORA=true
    echo "⚠  Fedora detected — consider setting USE_FEDORA=true in this script."
  fi
fi

# --- Dependency Lists ---
DEBIAN_PACKAGES=(
  curl
  git
  ufw
  jq
  unzip
  gnupg
  xclip # For copying ngrok URL to clipboard
)

FEDORA_PACKAGES=(
  curl
  git
  firewalld
  jq
  unzip
  gnupg2
  xclip # For copying ngrok URL to clipboard
)

# --- Package Installation ---
echo "🔧 Installing dependencies..."

if [[ "$USE_FEDORA" == true ]]; then
  sudo dnf install -y "${FEDORA_PACKAGES[@]}"

  # Enable firewalld if not already running
  sudo systemctl enable firewalld
  sudo systemctl start firewalld
else
  sudo apt update
  sudo apt install -y "${DEBIAN_PACKAGES[@]}"
fi

# --- Caddy Installation ---
echo "🌐 Installing Caddy..."

if [[ "$USE_FEDORA" == true ]]; then
  sudo dnf install -y 'dnf-command(copr)'
  sudo dnf copr enable -y @caddy/caddy
  sudo dnf install -y caddy
else
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    sed 's/^deb /deb [signed-by=\/usr\/share\/keyrings\/caddy-archive-keyring.gpg] /' | \
    sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update
  sudo apt install -y caddy
fi

# --- Ngrok Installation ---
echo "🌍 Installing Ngrok CLI..."

# Diagnostic: Find out which ngrok is being used
if command -v ngrok &> /dev/null; then
  echo "Diagnostic: ngrok found at: $(which ngrok)"
  echo "Diagnostic: ngrok version: $(ngrok version)"
  echo "Diagnostic: Removing existing ngrok binary from $(which ngrok)..."
  sudo rm -f "$(which ngrok)" || true # Remove the found binary
else
  echo "Diagnostic: No ngrok found in PATH initially."
fi

# Now proceed with installation
if ! command -v ngrok &> /dev/null; then
  # Method 1: Try official package repositories first (recommended)
  echo "Attempting to install ngrok via official repositories..."
  
  if [[ "$USE_FEDORA" == true ]]; then
    # For Fedora/RHEL - use snap or try direct download
    if command -v snap &> /dev/null; then
      sudo snap install ngrok
      echo "Ngrok installed via snap"
    else
      echo "Snap not available, falling back to direct download..."
    fi
  else
    # For Debian/Ubuntu - use official apt repository
    curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
      sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
      echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
      sudo tee /etc/apt/sources.list.d/ngrok.list && \
      sudo apt update && sudo apt install ngrok
    
    if command -v ngrok &> /dev/null; then
      echo "Ngrok installed via official apt repository"
    else
      echo "Official repository installation failed, falling back to direct download..."
    fi
  fi
  
  # Method 2: Direct download fallback (if repository method didn't work)
  if ! command -v ngrok &> /dev/null; then
    echo "Using direct download method..."
    
    NGROK_ARCH="amd64"
    NGROK_OS="linux"
    
    if [[ "$(uname -m)" == "aarch64" ]]; then
      NGROK_ARCH="arm64"
    fi
    
    # Use the newer download.ngrok.com URL structure
    NGROK_ZIP="ngrok-v3-stable-${NGROK_OS}-${NGROK_ARCH}.tgz"
    NGROK_URL="https://bin.equinox.io/c/bNyj1mQVY4c/${NGROK_ZIP}"
    
    echo "Downloading Ngrok from ${NGROK_URL}"
    if ! curl -L "${NGROK_URL}" -o "/tmp/${NGROK_ZIP}"; then
      echo "Primary URL failed, trying alternative..."
      # Alternative: Try the github releases or different URL structure
      NGROK_URL="https://github.com/ngrok/ngrok/releases/latest/download/ngrok-v3-stable-${NGROK_OS}-${NGROK_ARCH}.tgz"
      if ! curl -L "${NGROK_URL}" -o "/tmp/${NGROK_ZIP}"; then
        echo "Error: Failed to download Ngrok from all sources." >&2
        echo "Please visit https://ngrok.com/download to download manually." >&2
        exit 1
      fi
    fi
    
    # Check if file is actually downloaded and not empty
    if [ ! -s "/tmp/${NGROK_ZIP}" ]; then
      echo "Error: Downloaded file is empty or corrupted." >&2
      echo "Please visit https://ngrok.com/download to download manually." >&2
      exit 1
    fi
    
    # Check file type and extract accordingly
    file_type=$(file "/tmp/${NGROK_ZIP}")
    if [[ "$file_type" == *"gzip"* ]] || [[ "$file_type" == *"tar"* ]]; then
      echo "Extracting tar.gz archive..."
      sudo tar -xzf "/tmp/${NGROK_ZIP}" -C /usr/local/bin
    elif [[ "$file_type" == *"Zip"* ]]; then
      echo "Extracting zip archive..."
      sudo unzip -o "/tmp/${NGROK_ZIP}" -d /usr/local/bin
    else
      echo "Error: Unknown file format: $file_type" >&2
      echo "Downloaded file might be corrupted or an error page." >&2
      exit 1
    fi
    
    sudo chmod +x /usr/local/bin/ngrok
    rm "/tmp/${NGROK_ZIP}"
    echo "Ngrok installed to /usr/local/bin/ngrok"
  fi
else
  echo "Ngrok is already installed."
fi

# Verify installation
if command -v ngrok &> /dev/null; then
  echo "✅ Ngrok installation verified: $(ngrok version)"
else
  echo "❌ Ngrok installation failed" >&2
  exit 1
fi

# Configure Ngrok authtoken from config.json
echo "Configuring Ngrok authtoken from $CONFIG_FILE..."
if [ -f "$CONFIG_FILE" ]; then
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is required to read authtoken from config.json. Please install it." >&2
  else
    AUTHTOKEN=$(jq -r '.networking.ngrok.authToken // ""' "$CONFIG_FILE")
    if [ -n "$AUTHTOKEN" ]; then
      ngrok config add-authtoken "$AUTHTOKEN"
      echo "Ngrok authtoken configured successfully."
    else
      echo "Warning: Ngrok authtoken not found in $CONFIG_FILE. Ngrok will run unauthenticated." >&2
      echo "To persist your ngrok configuration, add your authtoken to networking.ngrok.authToken in $CONFIG_FILE." >&2
      echo "Get your authtoken from: https://dashboard.ngrok.com/get-started/setup" >&2
    fi
  fi
else
  echo "Warning: Config file not found at $CONFIG_FILE. Ngrok authtoken cannot be configured." >&2
  echo "Ngrok will run unauthenticated. Please create $CONFIG_FILE and add your authtoken." >&2
  echo "Get your authtoken from: https://dashboard.ngrok.com/get-started/setup" >&2
fi

# --- Firewall Rules ---
echo "🛡 Setting up firewall..."

if [[ "$USE_FEDORA" == true ]]; then
  sudo firewall-cmd --permanent --add-service=ssh
  sudo firewall-cmd --permanent --add-service=http
  sudo firewall-cmd --permanent --add-service=https
  sudo firewall-cmd --reload
else
  sudo ufw allow OpenSSH
  sudo ufw allow http
  sudo ufw allow https
  sudo ufw --force enable
fi

# --- Final Status ---
echo "✅ Setup complete!"