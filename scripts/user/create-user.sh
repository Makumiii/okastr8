#!/usr/bin/env bash
set -eou pipefail

USERNAME=$1
PASSWORD=$2
DISTRO=$3

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

echo "🎉 User '$USERNAME' created."
