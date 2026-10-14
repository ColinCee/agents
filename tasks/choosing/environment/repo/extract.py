"""Label messages with a model.

    python extract.py MODEL MESSAGES

MODEL is small, medium or large. Prints one {"id", "label", "confidence"} line per message.
"""

import json
import random
import sys
from pathlib import Path

import model

if len(sys.argv) != 3:
    raise SystemExit(__doc__)
rng = random.Random()
for line in Path(sys.argv[2]).read_text(encoding="utf-8").splitlines():
    m = json.loads(line)
    label, confidence = model.answer(sys.argv[1], m["id"], rng)
    print(json.dumps({"id": m["id"], "label": label, "confidence": confidence}))
