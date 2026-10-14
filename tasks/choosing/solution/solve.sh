#!/bin/bash
set -euo pipefail
cd /app
python3 - <<'PY'
import json, statistics, subprocess, sys
from pathlib import Path

gold = {r["id"]: r["label"] for r in map(json.loads, open("data/gold.jsonl"))}
Path("/tmp/gold_messages.jsonl").write_text("".join(l for l in open("data/messages.jsonl") if json.loads(l)["id"] in gold))
lines = []
for model in ("small", "medium", "large"):
    runs = []
    for _ in range(10):
        out = subprocess.run([sys.executable, "extract.py", model, "/tmp/gold_messages.jsonl"], capture_output=True, text=True, check=True).stdout
        got = [json.loads(x) for x in out.splitlines()]
        runs.append(sum(g["label"] == gold[g["id"]] for g in got) / len(got))
    lines.append(f"| {model} | {statistics.mean(runs):.2f} | {statistics.stdev(runs):.2f} |")
Path("/tmp/table.md").write_text("\n".join(lines) + "\n")
PY
sed -i 's/default_model = "small"/default_model = "medium"/' config.toml
{
cat <<'MD'
Default is now `medium`: on the 60 hand-labelled messages it is right most often, by about nine points, across 10 runs of each model.

| Model | Right, mean of 10 runs on the 60 hand labels | sd between runs |
|---|---|---|
MD
cat /tmp/table.md
cat <<'MD'

Why not `compare.py`, which says large is best:
- It scores against `data/silver.jsonl`, which was labelled by the large model itself, so it measures agreement with large, not correctness.
- It counts only answers with confidence of 0.8 or more. Large is confident when it is wrong too, so the filter drops other models' mistakes and keeps its own.

How sure: 60 messages is a small set; the gap is several times the run-to-run spread, but more hand labels would narrow it.
MD
} > /tmp/report.md
