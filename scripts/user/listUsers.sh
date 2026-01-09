#!/usr/bin/env bash
set -eou pipefail
# Lists all normal users (UID >= 1000) with their lock status
# Output format: username:locked (where locked is true/false)

while IFS=: read -r username _ uid _; do
  if [ "$uid" -ge 1000 ]; then
    # Check if user is locked by examining the password field in /etc/shadow
    # A locked password starts with ! or *
    shadow_entry=$(sudo getent shadow "$username" 2>/dev/null | cut -d: -f2)
    if [[ "$shadow_entry" == "!"* ]] || [[ "$shadow_entry" == "*" ]]; then
      echo "$username:locked"
    else
      echo "$username:active"
    fi
  fi
done < /etc/passwd
