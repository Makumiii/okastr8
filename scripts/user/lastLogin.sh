#!/bin/bash
# Shows the last login time for a given user

if [ -z "$1" ]; then
  echo "Usage: $0 <username>"
  exit 1
fi

lastlog -u "$1"
