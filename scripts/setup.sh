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

# --- Ngrok Installation (Direct Download) ---
echo "🌍 Installing Ngrok CLI..."

if ! command -v ngrok &> /dev/null; then
  NGROK_ARCH="amd64"
  if [[ "$(uname -m)" == "aarch64" ]]; then
    NGROK_ARCH="arm64"
  fi

  NGRK_ZIP="ngrok-stable-linux-${NGROK_ARCH}.zip"
  NGRK_URL="https://bin.equinox.io/c/4VmDzA7iaHb/${NGRK_ZIP}"

  echo "Downloading Ngrok from ${NGRK_URL}"
  if ! curl -L "${NGRK_URL}" -o "/tmp/${NGRK_ZIP}"; then
    echo "Error: Failed to download Ngrok." >&2
    exit 1
  fi

  echo "Unzipping Ngrok..."
  if ! sudo unzip -o "/tmp/${NGRK_ZIP}" -d /usr/local/bin; then
    echo "Error: Failed to unzip Ngrok." >&2
    exit 1
  fi

  sudo chmod +x /usr/local/bin/ngrok
  rm "/tmp/${NGRK_ZIP}"
  echo "Ngrok installed to /usr/local/bin/ngrok"
else
  echo "Ngrok is already installed."
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