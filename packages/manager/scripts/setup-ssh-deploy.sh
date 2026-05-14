#!/usr/bin/env bash
set -eou pipefail

# ==============================================================================
# Okastr8 SSH Deploy Key Setup
# ==============================================================================
# This script creates a dedicated, passphrase-free SSH key for automated
# Git operations (cloning, pulling). This ensures background services can
# authenticate without user interaction.
#
# The key is stored at: ~/.ssh/okastr8_deploy_key
# ==============================================================================

# Configuration
SSH_DIR="$HOME/.ssh"
KEY_NAME="okastr8_deploy_key"
KEY_PATH="$SSH_DIR/$KEY_NAME"
SSH_CONFIG="$SSH_DIR/config"

echo "================================================================"
echo "  Okastr8 SSH Deploy Key Setup"
echo "================================================================"

# Create .ssh directory if it doesn't exist
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

# Check if key already exists
if [ -f "$KEY_PATH" ]; then
    echo "✅ SSH deploy key already exists at: $KEY_PATH"
    echo "   Skipping key generation."
else
    echo "🔑 Generating new SSH deploy key (no passphrase)..."
    ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "okastr8-deploy-key"
    chmod 600 "$KEY_PATH"
    chmod 644 "$KEY_PATH.pub"
    echo "✅ SSH key generated successfully!"
fi

# Configure SSH to use this key for GitHub
echo ""
echo "📝 Configuring SSH to use deploy key for GitHub..."

# Check if config already has our entry
if grep -q "# Okastr8 Deploy Key" "$SSH_CONFIG" 2>/dev/null; then
    echo "   SSH config already configured for okastr8."
else
    # Add GitHub configuration
    cat >> "$SSH_CONFIG" <<EOF

# Okastr8 Deploy Key - Auto-generated
Host github.com
    HostName github.com
    User git
    IdentityFile $KEY_PATH
    IdentitiesOnly yes
EOF
    chmod 600 "$SSH_CONFIG"
    echo "✅ SSH config updated!"
fi

# Configure Git to use SSH for GitHub (redirect HTTPS to SSH)
echo ""
echo "🔧 Configuring Git to use SSH for all GitHub operations..."
git config --global url."git@github.com:".insteadOf "https://github.com/"
echo "✅ Git configured to use SSH!"

# Display the public key for user to add to GitHub
echo ""
echo "================================================================"
echo "  🎉 Setup Complete!"
echo "================================================================"
echo ""
echo "📋 NEXT STEP: Add this public key to your GitHub account:"
echo ""
echo "   1. Go to: https://github.com/settings/keys"
echo "   2. Click 'New SSH Key'"
echo "   3. Give it a title like 'Okastr8 Deploy Key'"
echo "   4. Paste this key:"
echo ""
echo "─────────────────────────────────────────────────────────────────"
cat "$KEY_PATH.pub"
echo "─────────────────────────────────────────────────────────────────"
echo ""
echo "   Or run: cat $KEY_PATH.pub | xclip -selection clipboard"
echo ""
echo "After adding the key, test with: ssh -T git@github.com"
echo ""
