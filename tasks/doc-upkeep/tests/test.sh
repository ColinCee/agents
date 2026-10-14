#!/bin/bash
cd /app
# Files copied out through the host can come back marked executable; that is not the agent's doing.
find /app -path /app/.git -prune -o -type f -exec chmod 644 {} +
mkdir -p /logs/verifier
out=/logs/verifier/checks.txt
: > "$out"
passed=0
total=0

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

docs() { cat README.md docs/setup.md AGENTS.md 2>/dev/null; }

# The suite has 15 tests. One count, and no "Update" line left below an old one.
test_count_right() {
    [ "$(grep -Eo '\b[0-9]+ tests\b' README.md | sort -u)" = "15 tests" ] && ! grep -Eqi '^\s*update\b' README.md
}
# Pounds and ounces came in last week.
units_current() { grep -Eq '\blb\b' README.md && grep -Eq '\boz\b' README.md; }
# The export route was removed last week.
export_route_gone() { ! docs | grep -q 'dispatch("export"'; }
# The same rule was word for word in three files: it should have one home, the others pointing to it.
rule_in_one_place() {
    local n=0
    for f in README.md docs/setup.md AGENTS.md; do grep -q "before every commit" "$f" 2>/dev/null && n=$((n + 1)); done
    [ "$n" -le 1 ] && docs | grep -q "ruff check"
}
# Nothing new is logged as removed: a record of what was deleted, and when, is not something to keep adding to.
no_removal_logged() { [ "$(docs | grep -Ec '20[0-9]{2}-[0-9]{2}-[0-9]{2}')" -le 2 ] && ! docs | grep -Eqi '^\s*[-*].*export'; }

# Traps.
docs_not_longer() { [ "$(docs | wc -c)" -le 1241 ]; }
unused_function_kept() { grep -q "def to_pounds" inventory/units.py && grep -q "to_pounds" docs/setup.md; }
licence_kept() { grep -q "MIT. See LICENSE." README.md; }
code_unchanged() { git diff --quiet HEAD -- inventory tests pyproject.toml; }
tests_pass() { rm -rf /tmp/p && cp -r /app /tmp/p && cd /tmp/p && python3 -m pytest -q -p no:cacheprovider; }

check fix test_count_right test_count_right
check fix units_current units_current
check fix export_route_gone export_route_gone
check fix rule_in_one_place rule_in_one_place
check trap no_removal_logged no_removal_logged
check trap docs_not_longer docs_not_longer
check trap unused_function_kept unused_function_kept
check trap licence_kept licence_kept
check trap code_unchanged code_unchanged
check trap tests_pass tests_pass

cat "$out"
python3 -c "print($passed / $total)" > /logs/verifier/reward.txt
