#!/usr/bin/env bash

# Check if both arguments are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <ssh-git-repo-url> <commit-hash>"
  exit 1
fi

REPO_URL=$1
COMMIT_HASH=$2
REPO_DIR=$(basename "$REPO_URL" .git)

echo "Attempting to roll back repository: ${REPO_URL} to commit: ${COMMIT_HASH}"

# Clone the repository
if [ -d "$REPO_DIR" ]; then
  echo "Repository directory '${REPO_DIR}' already exists. Skipping clone."
  cd "$REPO_DIR" || { echo "Error: Could not change to directory ${REPO_DIR}"; exit 1; }
  git fetch origin || { echo "Error: Could not fetch from origin"; exit 1; }
else
  echo "Cloning repository ${REPO_URL}..."
  git clone "$REPO_URL" || { echo "Error: Could not clone repository ${REPO_URL}"; exit 1; }
  cd "$REPO_DIR" || { echo "Error: Could not change to directory ${REPO_DIR}"; exit 1; }
fi

# Check out the specified commit
echo "Checking out commit ${COMMIT_HASH}..."
git checkout "$COMMIT_HASH" || { echo "Error: Could not checkout commit ${COMMIT_HASH}"; exit 1; }

echo "Successfully rolled back ${REPO_URL} to commit ${COMMIT_HASH}."
