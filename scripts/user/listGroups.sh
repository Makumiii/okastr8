#!/usr/bin/env bash
# Lists all groups for a given user

if [ -z "$1" ]; then
  echo "Usage: $0 <username>"
  exit 1
fi

groups "$1"
