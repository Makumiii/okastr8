#!/usr/bin/env bash
set -eou pipefail

OKASTR8_DIR="/etc/systemd/system/okastr8"

if [ ! -d "$OKASTR8_DIR" ]; then
  echo "Directory not found: ${OKASTR8_DIR}"
  exit 1
fi

echo "Listing service files in ${OKASTR8_DIR}:"
ls -l "${OKASTR8_DIR}"/*.service
