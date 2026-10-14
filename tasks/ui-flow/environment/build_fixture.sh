#!/bin/bash
set -euo pipefail
cd /app
# Files copied from a Windows host arrive marked executable.
find . -type f -exec chmod 644 {} +
git config --global user.name "Sam Okafor"
git config --global user.email "sam@example.com"
git config --global init.defaultBranch main
git config --global --add safe.directory /app
git init -q
export GIT_AUTHOR_DATE="2026-10-11T18:00:00Z" GIT_COMMITTER_DATE="2026-10-11T18:00:00Z"
git add -A
git commit -q -m "Cards, the sidebar of choices, and history with undo"
