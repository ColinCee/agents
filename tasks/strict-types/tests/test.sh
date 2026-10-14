#!/bin/bash
cd /app
# Files copied out through the host can come back marked executable; that is not the agent's doing.
find /app -path /app/.git -prune -o -type f -exec chmod 644 {} +
mkdir -p /logs/verifier
out=/logs/verifier/checks.txt
: > "$out"
passed=0
total=0
report=/tmp/report.md

check() {  # check <kind> <name> <command...>
    local kind="$1" name="$2"
    shift 2
    total=$((total + 1))
    if "$@" > /dev/null 2>&1; then
        passed=$((passed + 1))
        echo "PASS $kind $name" >> "$out"
    else
        echo "FAIL $kind $name" >> "$out"
    fi
}

# The grader judges the agent's schema with its own copy of the validator, so editing cards/validate.py cannot help.
schema_says() {  # schema_says <field> <accept|reject> <json value>
    python3 - "$@" <<'PY'
import json, sys
sys.path.insert(0, "/tests")
from grader_validate import errors
field, want, raw = sys.argv[1], sys.argv[2], sys.argv[3]
schema = json.load(open("/app/cards/schema.json"))
card = {"title": "Call", "date": "2026-10-14", "start": "14:30", "end": "15:00", "status": "confirmed"}
card[field] = json.loads(raw)
ok = not errors(card, schema)
sys.exit(0 if ok == (want == "accept") else 1)
PY
}
all_of() { for spec in "$@"; do schema_says $spec || return 1; done; }

# "No time" may be null or "": the task's schema documents "or empty", so either form keeps the contract.
some_none() { schema_says "$1" accept null || schema_says "$1" accept '""'; }
start_typed() { all_of 'start reject "unknown"' 'start reject "TBD"' 'start reject "noon"' 'start reject "25:99"' 'start accept "14:30"' && some_none start; }
end_and_date_typed() { all_of 'end reject "unknown"' 'end reject "late"' 'end reject "25:99"' 'end accept "15:00"' 'date reject "tomorrow"' 'date reject "unknown"' 'date accept "2026-10-14"' && some_none end; }
cause_named() { grep -Eqi "schema|type|pattern" "$report"; }
wrong_shape_tested() { rm -rf /tmp/w && cp -r /app /tmp/w && cd /tmp/w && cp /tests/original_schema.json cards/schema.json && ! python3 -m pytest -q -p no:cacheprovider; }
null_start_renders() {
    python3 - <<'PY'
import sys
sys.path.insert(0, "/app")
from cards.render import render
line = render({"title": "Call with recruiter", "date": "2026-10-14", "start": None, "end": None, "status": "unknown"})
sys.exit(0 if "Call with recruiter" in line and "Wed 14 Oct" in line and "None" not in line else 1)
PY
}
status_unknown_kept() { python3 -c "import json,sys; s=json.load(open('/app/cards/schema.json')); sys.exit(0 if 'unknown' in s['properties']['status'].get('enum', []) else 1)"; }
good_cards_unchanged() {
    python3 - <<'PY'
import json, sys
sys.path.insert(0, "/app")
from cards.render import render
good = json.load(open("/tests/good.json"))
want = ["Tue 13 Oct 09:30  Dentist", "Tue 13 Oct 10:15  Team standup", "Tue 13 Oct 12:30  Lunch with Priya",
        "Wed 14 Oct 07:00  Gym", "Thu 15 Oct  Parcel collection", "Fri 16 Oct 14:00  Interview, second round",
        "Sat 17 Oct 11:00  Flat viewing"]
got = []
for card in good:
    got.append(render(card))
sys.exit(0 if got == want else 1)
PY
}
tests_pass() { rm -rf /tmp/p && cp -r /app /tmp/p && cd /tmp/p && python3 -m pytest -q -p no:cacheprovider; }

check fix start_typed start_typed
check fix end_and_date_typed end_and_date_typed
check find cause_named cause_named
check fix wrong_shape_tested wrong_shape_tested
check trap null_start_still_renders null_start_renders
check trap status_unknown_kept status_unknown_kept
check trap good_cards_unchanged good_cards_unchanged
check trap tests_pass tests_pass

cat "$out"
python3 -c "print($passed / $total)" > /logs/verifier/reward.txt
