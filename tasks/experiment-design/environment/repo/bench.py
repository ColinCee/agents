"""Score each prompt against its labels.

    python bench.py

Prints the accuracy of each prompt and saves this run to results/runs.jsonl for the weekly chart.
"""

import json
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
ARMS = [
    ("v1", "cases/old.jsonl", "labels/human.jsonl"),
    ("v2", "cases/new.jsonl", "labels/auto.jsonl"),
]


def load(path: str) -> dict:
    rows = [json.loads(line) for line in (HERE / path).read_text(encoding="utf-8").splitlines()]
    return {row["id"]: row["label"] for row in rows}


lines = []
for prompt, cases, labels in ARMS:
    out = subprocess.run(
        [sys.executable, str(HERE / "classify.py"), prompt, str(HERE / cases)],
        capture_output=True, text=True, check=True,
    ).stdout
    got = {row["id"]: row["label"] for row in map(json.loads, out.splitlines())}
    truth = load(labels)
    right = sum(got[i] == truth[i] for i in got)
    accuracy = right / len(got)
    print(f"{prompt}: {accuracy:.2f} on {len(got)} tickets ({cases}, {labels})")
    lines.append({"date": date.today().isoformat(), "prompt": prompt, "cases": cases, "labels": labels, "accuracy": round(accuracy, 3)})

(HERE / "results").mkdir(exist_ok=True)
with open(HERE / "results" / "runs.jsonl", "w", encoding="utf-8") as f:
    for line in lines:
        f.write(json.dumps(line) + "\n")
