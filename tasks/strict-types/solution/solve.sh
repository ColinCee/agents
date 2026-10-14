#!/bin/bash
set -euo pipefail
cd /app
python3 - <<'PY'
import json
from pathlib import Path
p = Path("cards/schema.json")
s = json.loads(p.read_text())
time = {"type": ["string", "null"], "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"}
s["properties"]["start"] = dict(time)
s["properties"]["end"] = dict(time)
s["properties"]["date"] = {"type": ["string", "null"], "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"}
p.write_text(json.dumps(s, indent=2) + "\n")
r = Path("cards/responses.json")
answers = json.loads(r.read_text())
for a in answers:
    for k in ("start", "end", "date"):
        if a.get(k) == "":
            a[k] = None
r.write_text(json.dumps(answers, indent=2) + "\n")
PY
cat > cards/render.py <<'PY'
from datetime import date


def render(card: dict) -> str:
    """One line of the calendar: day, start time, title."""
    day = date.fromisoformat(card["date"]).strftime("%a %d %b")
    start = card["start"]
    if start:
        return f"{day} {start}  {card['title']}"
    return f"{day}  {card['title']}"
PY
cat >> tests/test_cards.py <<'PY'


def test_a_time_that_is_not_a_time_is_refused():
    for bad in ("unknown", "TBD", "25:99"):
        answer = {"title": "Call", "date": "2026-10-14", "start": bad, "end": None, "status": "unknown"}
        assert cards([answer], SCHEMA) == []


def test_no_time_is_null():
    answer = {"title": "Call", "date": "2026-10-14", "start": None, "end": None, "status": "unknown"}
    assert cards([answer], SCHEMA) == ["Wed 14 Oct  Call"]
PY
python3 -m pytest -q
cat > /tmp/report.md <<'MD'
The card read "unkno" because the answer's format typed the start time as any text: "HH:MM, or empty" was only a description, so the model's "unknown" passed.

Fixed at the type: `start` and `end` must match a time pattern or be null, `date` a date pattern or null, in `cards/schema.json`. Tests now feed wrong-shaped times and check they are refused. `status` keeps "unknown", which is a real status.
MD
