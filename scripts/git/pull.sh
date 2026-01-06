#!/usr/bin/env bash
set -eou pipefail

# Safe git pull script with stash and conflict handling
# Usage: git-pull.sh <repo_path> [branch]

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <repo_path> [branch]"
  exit 1
fi

REPO_PATH="$1"
BRANCH="${2:-}"

if [ ! -d "$REPO_PATH/.git" ]; then
  echo "❌ Not a git repository: $REPO_PATH" >&2
  exit 1
fi

cd "$REPO_PATH"

echo "📦 Repository: $REPO_PATH"
echo "🔄 Pulling latest changes..."

# Fetch first to see what's available
git fetch --all --prune

# Stash any local changes
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo "📝 Stashing local changes..."
  git stash push -m "okastr8-auto-stash-$(date +%Y%m%d_%H%M%S)"
  STASHED=true
else
  STASHED=false
fi

# Switch to branch if specified
if [ -n "$BRANCH" ]; then
  CURRENT_BRANCH=$(git branch --show-current)
  if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "🔀 Switching from $CURRENT_BRANCH to $BRANCH..."
    git checkout "$BRANCH" || { echo "❌ Failed to checkout $BRANCH"; exit 1; }
  fi
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
  echo "❌ Detached HEAD state. Please checkout a branch first." >&2
  exit 1
fi

# Pull changes
echo "⬇️  Pulling origin/$CURRENT_BRANCH..."
if git pull origin "$CURRENT_BRANCH"; then
  echo "✅ Pull successful!"
else
  echo "❌ Pull failed. There may be conflicts." >&2
  if [ "$STASHED" = true ]; then
    echo "💡 Your local changes are in the stash. Run 'git stash pop' to restore."
  fi
  exit 1
fi

# Show what we're now at
echo ""
echo "📋 Current HEAD:"
git log -1 --oneline

echo ""
echo "✅ Git pull complete!"
