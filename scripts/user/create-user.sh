#!/usr/bin/env bash
set -eou pipefail

USERNAME=$1
PASSWORD=${2:-}
DISTRO=${3:-}

# Default password fallback
if [[ -z "$PASSWORD" ]]; then
  PASSWORD="$USERNAME"
fi

# Auto-detect distro if not provided
if [[ -z "$DISTRO" ]]; then
  if grep -qiE 'fedora|rhel|centos' /etc/os-release; then
    DISTRO="fedora"
  else
    DISTRO="debian"
  fi
fi

echo "🧱 Creating user '$USERNAME'..."

# Check if user already exists
if id "$USERNAME" &>/dev/null; then
  echo "✅ User '$USERNAME' already exists. Skipping creation."
else
  useradd -m -s /bin/bash "$USERNAME"
  echo "🔐 Setting password..."
  echo "$USERNAME:$PASSWORD" | chpasswd
fi

# Add user to the right sudo group
echo "🔑 Adding to sudo/wheel group..."
if [[ "$DISTRO" == "fedora" ]]; then
  usermod -aG wheel "$USERNAME" && echo "✅ Added to 'wheel' group (Fedora)."
else
  usermod -aG sudo "$USERNAME" && echo "✅ Added to 'sudo' group (Debian-based)."
fi

# Add to docker group if it exists
if getent group docker >/dev/null; then
  usermod -aG docker "$USERNAME" && echo "✅ Added to 'docker' group."
fi

# Initialize .ssh directory
USER_HOME=$(eval echo "~$USERNAME")
mkdir -p "$USER_HOME/.ssh"
touch "$USER_HOME/.ssh/authorized_keys"
chmod 700 "$USER_HOME/.ssh"
chmod 600 "$USER_HOME/.ssh/authorized_keys"
chown -R "$USERNAME:$USERNAME" "$USER_HOME/.ssh"
echo "🔐 SSH directory initialized for '$USERNAME'."

echo "🎉 User '$USERNAME' created."
