#!/bin/bash
set -euo pipefail
cd /app
python3 - <<'PY'
from pathlib import Path

store = Path("cards/store.py")
store.write_text(store.read_text().replace(
    'STATUSES = ("open", "added", "booked", "not_real")',
    'STATUSES = ("open", "added", "booked", "real_not_added", "not_real")',
))
views = Path("cards/views.py")
views.write_text(views.read_text().replace(
    '<button class="quiet" name="status" value="booked">Already booked</button>',
    '<button class="quiet" name="status" value="booked">Already booked</button>\n'
    '  <button class="quiet" name="status" value="real_not_added">Real, but don&#39;t add to calendar</button>',
))
history = Path("cards/history.py")
history.write_text(history.read_text().replace(
    '"booked": "Already booked",',
    '"booked": "Already booked",\n    "real_not_added": "Real, kept out of your calendar",',
))
PY
python3 -m pytest -q
cat > /tmp/report.md <<'MD'
Added "Real, but don't add to calendar" to the card's sidebar, as a quiet button under "Already booked", so "Add to calendar" stays the one main action.

Where it goes: the card leaves Open cards and shows in History as "Real, kept out of your calendar", with Undo, like the other choices. History keeps its own list of decisions in `cards/history.py`; the new one is added there.
MD
