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
python3 /tmp/make_data.py /app

at() { export GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1"; }

mkdir /tmp/later && mv prompts/v2.txt cases/new.jsonl labels/auto.jsonl results.md /tmp/later/
at "2026-09-12T18:00:00Z"
git add -A
git commit -q -m "Ticket triage with the v1 prompt; 120 tickets labelled by hand"

mv /tmp/later/v2.txt prompts/ && mv /tmp/later/new.jsonl cases/ && mv /tmp/later/auto.jsonl labels/
at "2026-09-30T20:15:00Z"
git add -A
git commit -q -m "v2 prompt, and October's tickets labelled with v2 to save time"

mv /tmp/later/results.md .
at "2026-10-12T21:40:00Z"
git add -A
git commit -q -m "v2 beats v1"
rmdir /tmp/later
