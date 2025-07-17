#!/bin/bash

username=$1

# Check if username is provided
if [ -z "$username" ]; then
  echo "❌ Usage: $0 <username>"
  exit 1
fi

# Check if user exists
if ! id "$username" &>/dev/null; then
  echo "⚠️ User '$username' does not exist."
  exit 1
fi

# Delete user and their home directory
echo "🧨 Deleting user '$username' and their home directory..."
sudo userdel -r "$username"

if [ $? -eq 0 ]; then
  echo "✅ User '$username' deleted successfully."
else
  echo "❌ Failed to delete user '$username'."
  exit 1
fi
