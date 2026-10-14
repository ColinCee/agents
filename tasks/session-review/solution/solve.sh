#!/bin/bash
set -euo pipefail
cat > /tmp/report.md <<'MD'
Four corrections came back more than once in nine sessions over three projects. One of them was already written down and repeated anyway.

| Correction | Sessions | Projects | Where it should live |
|---|---|---|---|
| Stop ending on "Shall I…?"; do the next step | 4 | alpha, beta, gamma | Your user-level file (`~/.claude/AGENTS.md`), since it applies to every project |
| Migrations go through `make migrate`, never alembic directly (it seeds the test database) | 3 | beta | beta's `AGENTS.md` |
| Install with `uv add`, never `pip install` | 3 | beta, gamma (already a rule in alpha's `AGENTS.md`) | Your user-level file: a rule in one project did not reach the others. Remove it from alpha's file once moved |
| Take a screenshot before saying a UI change works | 3 | alpha, gamma | A skill candidate: the same check in three sessions; it is a procedure, not one line |

Left out: one-off choices (a colour, a variable name) and product feedback.

Nothing was changed: these are proposals for you to apply.
MD
