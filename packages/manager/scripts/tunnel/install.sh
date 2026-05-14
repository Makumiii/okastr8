#!/bin/bash
set -e

# Detect Architecture
ARCH=$(dpkg --print-architecture)

if [ "$ARCH" = "amd64" ]; then
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
elif [ "$ARCH" = "arm64" ]; then
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
elif [ "$ARCH" = "armhf" ]; then
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm"
elif [ "$ARCH" = "386" ]; then
    URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-386"
else
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
fi

echo "⬇️ Downloading cloudflared for $ARCH..."
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH.deb 2>/dev/null || true

# Verify if deb download worked, if not fall back to binary
if [ -f "cloudflared.deb" ] && [ -s "cloudflared.deb" ]; then
    echo "📦 Installing from DEB package..."
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
else
    echo "⬇️ Downloading binary directly..."
    curl -L --output cloudflared $URL
    chmod +x cloudflared
    sudo mv cloudflared /usr/local/bin/cloudflared
fi

# Verify installation
if command -v cloudflared &> /dev/null; then
    VERSION=$(cloudflared --version)
    echo "✅ Cloudflared installed successfully: $VERSION"
else
    echo "❌ Installation failed."
    exit 1
fi
