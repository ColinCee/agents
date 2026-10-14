"""Compare the models on the labelled messages.

    python compare.py

Counts only answers a model is confident about (0.8 or more): an unsure answer goes to a person anyway.
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
labels = {r["id"]: r["label"] for r in map(json.loads, (HERE / "data/silver.jsonl").read_text().splitlines())}
for name in ("small", "medium", "large"):
    out = subprocess.run([sys.executable, str(HERE / "extract.py"), name, str(HERE / "data/messages.jsonl")], capture_output=True, text=True, check=True).stdout
    sure = [r for r in map(json.loads, out.splitlines()) if r["confidence"] >= 0.8]
    right = sum(r["label"] == labels[r["id"]] for r in sure)
    print(f"{name}: {right / max(len(sure), 1):.2f} right of {len(sure)} confident answers")
