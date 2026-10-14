#!/bin/bash
cd /app
# Files copied out through the host can come back marked executable; that is not the agent's doing.
find /app -path /app/.git -prune -o -type f -exec chmod 644 {} +
mkdir -p /logs/verifier
out=/logs/verifier/checks.txt
: > "$out"

# The grader uses a copy, so nothing it presses changes the agent's files.
rm -rf /tmp/g && cp -r /app /tmp/g
(cd /tmp/g && python3 /tests/grade.py /tmp/g /tests/cards.json /tmp/report.md) >> "$out" 2>/logs/verifier/grade.err \
    || echo "FAIL fix grader_ran" >> "$out"

rm -rf /tmp/p && cp -r /app /tmp/p
if (cd /tmp/p && python3 -m pytest -q -p no:cacheprovider > /dev/null 2>&1); then
    echo "PASS trap tests_pass" >> "$out"
else
    echo "FAIL trap tests_pass" >> "$out"
fi

cat "$out"
python3 -c "
lines = open('$out').read().split()
checks = [l for l in open('$out').read().splitlines() if l.startswith(('PASS', 'FAIL'))]
print(sum(c.startswith('PASS') for c in checks) / max(len(checks), 1))
" > /logs/verifier/reward.txt
