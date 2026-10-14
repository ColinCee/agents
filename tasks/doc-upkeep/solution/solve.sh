#!/bin/bash
set -euo pipefail
cd /app
python3 - <<'PY'
from pathlib import Path

readme = Path("README.md")
text = readme.read_text()
text = text.replace("Units: `g`, `kg` and `t`.", "Units: `g`, `kg`, `t`, `lb` and `oz`.")
text = text.replace(
    'The web layer calls `inventory.routes.dispatch("import", text)` to read stock, and `dispatch("export", records)` to write it back out as CSV.',
    'The web layer calls `inventory.routes.dispatch("import", text)` to read stock.',
)
text = text.replace(
    "Run `ruff check .` and `pytest` before every commit. Stock files live in `data/stock/`, one per supplier.\n",
    "Checks and where stock files live: see `AGENTS.md`.\n",
)
text = text.replace("There are 12 tests. They take under a second.\n\nUpdate (Sep 30): now 14 tests.\n", "There are 15 tests. They take under a second.\n")
readme.write_text(text)

setup = Path("docs/setup.md")
setup.write_text(setup.read_text().replace(
    "Run `ruff check .` and `pytest` before every commit. Stock files live in `data/stock/`, one per supplier.\n",
    "See `AGENTS.md`.\n",
))
PY
cat > /tmp/report.md <<'MD'
The documents match the code again, and they are shorter.

| Where | Was | Now |
|---|---|---|
| README, Use | units g, kg, t | g, kg, t, lb, oz (added 7 October) |
| README, Routes | an export route | import only (export removed 9 October) |
| README, Develop | "12 tests" and an "Update: now 14" line | "15 tests", one line |
| README and docs/setup.md | the check rule, copied from `AGENTS.md` | a pointer to `AGENTS.md` |

Not changed: the Removed section (nothing added to it), `to_pounds` and its note in docs/setup.md (kept on purpose), the licence.
MD
