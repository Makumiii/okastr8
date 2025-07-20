#!/usr/bin/env bash
set -eou pipefail

# --- Config ---
USE_FEDORA=${USE_FEDORA:-false}

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
  wget
  git
  ufw
  jq
  unzip
  gnupg
)

FEDORA_PACKAGES=(
  curl
  wget
  git
  firewalld
  jq
  unzip
  gnupg2
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
