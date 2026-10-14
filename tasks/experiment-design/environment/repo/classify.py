"""Label support tickets with a prompt.

    python classify.py PROMPT CASES

PROMPT is a name under prompts/ (v1, v2). CASES is a .jsonl file of tickets. Prints one
{"id", "label"} line per ticket.
"""

import json
import random
import sys
from pathlib import Path

import model

if len(sys.argv) != 3:
    raise SystemExit(__doc__)
prompt, cases = sys.argv[1], Path(sys.argv[2])
if not (Path(__file__).parent / "prompts" / f"{prompt}.txt").is_file():
    raise SystemExit(f"No prompt named {prompt!r} under prompts/")
rng = random.Random()
for line in cases.read_text(encoding="utf-8").splitlines():
    ticket = json.loads(line)
    print(json.dumps({"id": ticket["id"], "label": model.answer(prompt, ticket["id"], rng)}))
