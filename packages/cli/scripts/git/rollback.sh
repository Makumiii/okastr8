#!/usr/bin/env bash
set -eou pipefail

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
TEMP_DIR=$(mktemp -d)

echo "Attempting to roll back repository: ${REPO_URL} to commit: ${COMMIT_HASH} in path: ${CLONE_PATH}"

# Create clone path if it doesn't exist
mkdir -p "$CLONE_PATH" || { echo "Error: Could not create directory ${CLONE_PATH}"; exit 1; }

echo "Cloning repository ${REPO_URL} into temporary directory ${TEMP_DIR}..."
git clone "$REPO_URL" "$TEMP_DIR/$REPO_NAME" || { echo "Error: Could not clone repository ${REPO_URL} into temporary directory"; rm -rf "$TEMP_DIR"; exit 1; }

cd "$TEMP_DIR/$REPO_NAME" || { echo "Error: Could not change to temporary repository directory"; rm -rf "$TEMP_DIR"; exit 1; }

# Check out the specified commit
echo "Checking out commit ${COMMIT_HASH}..."
git checkout "$COMMIT_HASH" || { echo "Error: Could not checkout commit ${COMMIT_HASH}"; rm -rf "$TEMP_DIR"; exit 1; }

# Move to target location
echo "Moving repository to target path: ${FULL_REPO_PATH}..."
if [ -d "$FULL_REPO_PATH" ]; then
  echo "Target directory '${FULL_REPO_PATH}' already exists. Removing it..."
  rm -rf "$FULL_REPO_PATH" || { echo "Error: Could not remove existing target directory"; rm -rf "$TEMP_DIR"; exit 1; }
fi

mv "$TEMP_DIR/$REPO_NAME" "$FULL_REPO_PATH" || { echo "Error: Could not move repository to target path"; rm -rf "$TEMP_DIR"; exit 1; }

# Clean up temporary directory
rm -rf "$TEMP_DIR"

echo "Successfully rolled back ${REPO_URL} to commit ${COMMIT_HASH}."
