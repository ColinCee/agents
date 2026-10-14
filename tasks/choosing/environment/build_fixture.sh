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

mkdir /tmp/later && mv compare.py data/silver.jsonl /tmp/later/
at "2026-09-20T18:00:00Z"
git add -A
git commit -q -m "Sort messages with the small model; 60 labelled by hand"

mv /tmp/later/compare.py . && mv /tmp/later/silver.jsonl data/
at "2026-10-08T21:10:00Z"
git add -A
git commit -q -m "Label all 300 with the large model, and a script to compare the models"
rmdir /tmp/later
