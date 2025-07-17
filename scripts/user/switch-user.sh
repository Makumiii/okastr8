#!/bin/bash
set -euo pipefail

USERNAME="$1"

if [[ -z "$USERNAME" ]]; then
  echo "❌ Usage: $0 <username>"
  exit 1
fi

if ! id "$USERNAME" &>/dev/null; then
  echo "❌ User '$USERNAME' does not exist."
  exit 1
fi

echo "👤 Switching to user '$USERNAME'..."
exec su - "$USERNAME"
