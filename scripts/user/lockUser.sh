#!/bin/bash
# Locks a user account

if [ -z "$1" ]; then
  echo "Usage: $0 <username>"
  exit 1
fi

# Check if user exists
if id "$1" &>/dev/null; then
  # This command usually requires root privileges to run.
  usermod -L "$1"
  echo "User account '$1' has been locked."
else
  echo "Error: User '$1' not found."
  exit 1
fi
