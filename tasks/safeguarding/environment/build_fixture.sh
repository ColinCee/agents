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

mv tools /tmp/tools-later
at "2026-01-20T19:00:00Z"
git add -A
git commit -q -m "Keep the reads and their marks, and hide names in shared copies"

mv /tmp/tools-later tools
at "2026-09-02T20:30:00Z"
git add -A
git commit -q -m "Add a mutation tool to score the tests"
