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
at() { export GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1"; }
at "2026-09-20T18:00:00Z"
git add -A
git commit -q -m "Turn the model's answers into calendar cards"
