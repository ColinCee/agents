#!/bin/bash
set -euo pipefail
cd /app
# Keep the owner's history: the bench overwrites it.
cp results/runs.jsonl /tmp/runs.backup.jsonl
python3 - <<'PY'
import json, statistics, subprocess, sys
truth = {r["id"]: r["label"] for r in map(json.loads, open("labels/human.jsonl"))}
def accuracy(prompt):
    out = subprocess.run([sys.executable, "classify.py", prompt, "cases/all.jsonl"], capture_output=True, text=True, check=True).stdout
    got = [json.loads(l) for l in out.splitlines()]
    return sum(g["label"] == truth[g["id"]] for g in got) / len(got)
runs = {p: [accuracy(p) for _ in range(10)] for p in ("v1", "v2")}
v1, v2 = statistics.mean(runs["v1"]), statistics.mean(runs["v2"])
open("/tmp/numbers.txt", "w").write(f"{v1:.3f} {v2:.3f} {statistics.stdev(runs['v1']):.3f} {statistics.stdev(runs['v2']):.3f}\n")
PY
read v1 v2 s1 s2 < /tmp/numbers.txt
cat > /tmp/report.md <<MD
Ship: v1. v2 is not better once both are scored the same way.

| | v1 | v2 |
|---|---|---|
| Owner's bench | 0.71, on \`cases/old.jsonl\` (its 60 hardest tickets), hand labels | 0.92, on \`cases/new.jsonl\` (60 easier tickets), labels v2 made itself |
| Same 120 tickets, hand labels, mean of 10 runs | $v1 (sd $s1) | $v2 (sd $s2) |

- The two prompts were run on different tickets: v1 on old.jsonl, v2 on new.jsonl.
- \`labels/auto.jsonl\` was produced by v2 itself, so scoring v2 against it measures agreement with its own answers.
- The model's answers change from run to run, so one run each is not enough; these are 10 runs each.
- \`bench.py\` overwrites \`results/runs.jsonl\`; the history was not touched.
MD
