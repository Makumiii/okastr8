#!/usr/bin/env bash
# Lists all normal users (UID >= 1000)

awk -F: '($3 >= 1000) {print $1}' /etc/passwd
