#!/bin/bash
set -euo pipefail
cd /app
python3 - <<'PY'
from pathlib import Path

views = Path("cards/views.py")
text = views.read_text()
start = text.index('    aside = f"""<aside>')
end = text.index('</aside>"""', start) + len('</aside>"""')
text = text[:start] + '''    aside = f"""<aside>
<form method="post" action="/card/{c["id"]}/status">
  <button class="primary" name="status" value="added">Add to calendar</button>
  <button class="quiet" name="status" value="booked">Already booked</button>
  <button class="quiet" name="status" value="not_real">Not real</button>
  <details><summary>More</summary>
    <button class="quiet" name="status" value="something_else">It's something else</button>
    <button class="quiet" name="status" value="time_changed">The time changed</button>
    <button class="quiet" name="status" value="snoozed">Remind me later</button>
    <select name="same_as"><option value="">Same as…</option>{others}</select>
    <button class="quiet" name="status" value="same_as">Same as</button>
  </details>
</form>
<form method="post" action="/card/{c["id"]}/notify">
  <label><input type="checkbox" name="notify" value="on" {"checked" if notify == "on" else ""} onchange="this.form.submit()"> Notify me about this card</label>
</form>
</aside>"""''' + text[end:]
text = text.replace("    n = store.counts()\n", "")
views.write_text(text)
PY
python3 -m pytest -q
cat > /tmp/report.md <<'MD'
The card's sidebar now asks one question with one main answer.

| Was | Now | Why |
|---|---|---|
| Two blue buttons, "Add to calendar" and "Already booked" | "Add to calendar" is the only main button; "Already booked" is quiet | Two main buttons compete; one decision, one main action |
| Seven choices in view | Three in view; the four rare ones under "More" | Fewer choices, quicker decision |
| A line of feed numbers | Removed from the card | It is not about this card |
| "Notify me →", a switch that looked like a link | A checkbox, "Notify me about this card" | It now looks like what it does |
MD
