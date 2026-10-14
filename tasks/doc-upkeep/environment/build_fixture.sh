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

# September: the code as the documents describe it, apart from the test count.
mkdir /tmp/october
for f in inventory/units.py inventory/routes.py inventory/handlers.py tests/test_units.py tests/test_routes.py; do
    mkdir -p "/tmp/october/$(dirname "$f")" && cp "$f" "/tmp/october/$f" && cp "/tmp/september/$f" "$f"
done
at "2026-09-30T18:00:00Z"
git add -A
git commit -q -m "Inventory parser, units and routes"

# Last week: pounds and ounces, and the export route is gone. The documents were not touched.
cp -r /tmp/october/. .
find . -path ./.git -prune -o -type f -exec chmod 644 {} +
at "2026-10-07T20:10:00Z"
git add inventory/units.py tests/test_units.py
git commit -q -m "Pounds and ounces"
at "2026-10-09T19:45:00Z"
git add -A
git commit -q -m "Remove the export route: the web layer writes CSV itself now"
rm -rf /tmp/october /tmp/september
