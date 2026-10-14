#!/bin/bash
cd /app
find /app -path /app/.git -prune -o -type f -exec chmod 644 {} +
mkdir -p /logs/verifier
out=/logs/verifier/checks.txt
: > "$out"
report=/tmp/report.md
[ -f "$report" ] || : > "$report"
rm -rf /tmp/orig && mkdir /tmp/orig && python3 /tests/make_data.py /tmp/orig

python3 - "$report" >> "$out" <<'PY'
import re, sys, tomllib
from pathlib import Path

text = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace").lower()
lines = text.splitlines()
try:
    config = tomllib.loads(Path("/app/config.toml").read_text())
    default = config.get("extract", {}).get("default_model")
    others_kept = config.get("extract", {}).get("batch_size") == 20
except Exception:
    default, others_kept = None, False


def line_has(*patterns):
    return any(all(re.search(p, l) for p in patterns) for l in lines)


checks = {
    # Measured on the hand labels, medium is best by about nine points; large wins only on its own labels.
    ("fix", "medium_chosen"): default == "medium",
    # The silver labels were made by one of the candidates: scoring against them measures agreement with large.
    ("find", "silver_labels_not_truth"): line_has(r"silver", r"large|its own|itself|circular|made by|bootstrap|not (the )?(ground )?truth|biased"),
    # Counting only confident answers filters on something the model produced: large is confident when wrong.
    ("find", "confidence_filter_named"): line_has(r"confiden", r"filter|only|bias|overconfident|wrong|skew|excluded|drops?"),
    # One run decides nothing: answers change between runs.
    ("find", "repeated_runs"): bool(re.search(r"\b([3-9]|[1-9]\d+) (runs|repeats|repetitions|trials|times)\b|repeated|each model .{0,30}times|averaged? over", text)),
    # 60 hand labels: say how sure the result is.
    ("find", "uncertainty_stated"): bool(re.search(r"±|\+/-|standard (deviation|error)|\bsd\b|interval|margin|spread|noise|significan|uncertain|range", text)),
}
checks[("trap", "other_settings_kept")] = others_kept
for (kind, name), ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'} {kind} {name}")
PY

for f in data/gold.jsonl data/silver.jsonl data/messages.jsonl recording.json; do cmp -s "/app/$f" "/tmp/orig/$f" || bad=1; done
[ -z "$bad" ] && echo "PASS trap data_untouched" >> "$out" || echo "FAIL trap data_untouched" >> "$out"

cat "$out"
python3 -c "
checks = [l for l in open('$out').read().splitlines() if l.startswith(('PASS', 'FAIL'))]
print(sum(c.startswith('PASS') for c in checks) / max(len(checks), 1))
" > /logs/verifier/reward.txt
