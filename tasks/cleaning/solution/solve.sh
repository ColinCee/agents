#!/bin/bash
set -euo pipefail
cd /app
cat > /tmp/report.md <<'MD'
One feature and its data can go; one test can destroy your pantry and should be fixed first.

**Fix before anything else:** `tests/test_store.py::test_save_roundtrip` saves to the default path, `var/pantry.json`. That file is yours, is not in git and has no backup. Running `pytest` replaces it with one line of test data. I did not run the tests.

| What | Evidence | Proposal |
|---|---|---|
| `compare` command, `pantry/compare.py`, `tests/test_compare.py`, `prices/` | 0 of the runs in `var/usage.log` (1 July to 30 September); not in the README; added 2 April for one decision and not changed since | Remove |
| `add`, `list`, `shop` | in the usage log most days; they are the stated purpose | Keep |
| `tests/test_shop.py::test_shop_list_sorted` | has no assertion, so it cannot fail | Fix or delete |

Decision needed: may the `compare` command and `prices/` be removed?
MD
