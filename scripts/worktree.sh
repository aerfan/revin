#!/usr/bin/env bash
# Usage: ./scripts/worktree.sh <task-name>
# Creates an isolated Git worktree branched from canary for parallel agent execution.

set -e

TASK_NAME="$1"
if [ -z "$TASK_NAME" ]; then
  echo "Usage: $0 <task-name>"
  echo "Example: $0 ai-brief-drafter"
  exit 1
fi

BRANCH="feat/${TASK_NAME}"
WORKTREE_DIR="../revin-${TASK_NAME}"

echo "Creating worktree at ${WORKTREE_DIR} on branch ${BRANCH}..."
git worktree add -b "${BRANCH}" "${WORKTREE_DIR}" canary

# Copy local development secrets if present
if [ -f .env.local ]; then
  cp .env.local "${WORKTREE_DIR}/.env.local"
  echo "Copied .env.local to ${WORKTREE_DIR}"
fi

echo "Worktree ready! To start working in parallel:"
echo "  cd ${WORKTREE_DIR}"
echo "  npm start"
