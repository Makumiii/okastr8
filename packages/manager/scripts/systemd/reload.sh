#!/usr/bin/env bash
set -eou pipefail

echo "Reloading systemd daemon..."
systemctl daemon-reload
echo "Systemd daemon reloaded."
