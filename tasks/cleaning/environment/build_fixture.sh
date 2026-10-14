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

# The comparison feature came later, for one decision, and was not touched again.
mkdir /tmp/later
mv pantry/compare.py tests/test_compare.py prices /tmp/later/
cp pantry/__main__.py /tmp/later/main_with_compare.py
python3 - <<'PY'
import re
from pathlib import Path

p = Path("pantry/__main__.py")
t = p.read_text()
t = t.replace("from pantry import compare, shop, store\n", "from pantry import shop, store\n")
t = re.sub(r'    sub\.add_parser\("compare".*?\n', "", t)
t = re.sub(r'    elif args\.command == "compare":\n.*?\n.*?\n', "", t)
p.write_text(t)
PY
at "2026-01-12T19:00:00Z"
git add -A
git commit -q -m "Track the pantry and build the shopping list"

mv /tmp/later/compare.py pantry/compare.py
mv /tmp/later/test_compare.py tests/test_compare.py
mv /tmp/later/prices prices
mv /tmp/later/main_with_compare.py pantry/__main__.py
rmdir /tmp/later
at "2026-04-02T20:15:00Z"
git add -A
git commit -q -m "Compare prices between the two shops, to decide where to move the weekly shop"

at "2026-09-21T18:40:00Z"
printf '\nRun `python -m pantry shop` before leaving the house.\n' >> README.md
git add -A
git commit -q -m "README: when to run shop"

# The owner's own data and usage record. Untracked: git cannot bring them back.
python3 /tmp/make_data.py var
touch -d "2026-09-30T19:10:00Z" var/pantry.json var/usage.log
