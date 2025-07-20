#!/usr/bin/env bash

# Check if all arguments are provided
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  echo "Usage: $0 <ssh-git-repo-url> <commit-hash> <clone-path>"
  exit 1
fi

REPO_URL=$1
COMMIT_HASH=$2
CLONE_PATH=$3
REPO_NAME=$(basename "$REPO_URL" .git)
FULL_REPO_PATH="${CLONE_PATH}/${REPO_NAME}"

echo "Attempting to roll back repository: ${REPO_URL} to commit: ${COMMIT_HASH} in path: ${CLONE_PATH}"

# Create clone path if it doesn't exist
mkdir -p "$CLONE_PATH" || { echo "Error: Could not create directory ${CLONE_PATH}"; exit 1; }

# Clone the repository
if [ -d "$FULL_REPO_PATH" ]; then
  echo "Repository directory '${FULL_REPO_PATH}' already exists. Skipping clone."
  cd "$FULL_REPO_PATH" || { echo "Error: Could not change to directory ${FULL_REPO_PATH}"; exit 1; }
  git fetch origin || { echo "Error: Could not fetch from origin"; exit 1; }
else
  echo "Cloning repository ${REPO_URL} into ${CLONE_PATH}..."
  git clone "$REPO_URL" "$FULL_REPO_PATH" || { echo "Error: Could not clone repository ${REPO_URL}"; exit 1; }
  cd "$FULL_REPO_PATH" || { echo "Error: Could not change to directory ${FULL_REPO_PATH}"; exit 1; }
fi

# Check out the specified commit
echo "Checking out commit ${COMMIT_HASH}..."
git checkout "$COMMIT_HASH" || { echo "Error: Could not checkout commit ${COMMIT_HASH}"; exit 1; }

echo "Successfully rolled back ${REPO_URL} to commit ${COMMIT_HASH}."
