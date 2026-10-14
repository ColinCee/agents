"""The fixture's tickets, labels, model recording and the owner's run history. The same bytes every time.

    python3 make_data.py ROOT
"""

import hashlib
import json
import random
import sys
from pathlib import Path

root = Path(sys.argv[1])
rng = random.Random(20260930)
LABELS = ["billing", "bug", "account", "other"]
TEXTS = {
    "billing": ["I was charged twice for {m}", "Refund for my {m} invoice?", "Card declined when paying for {m}", "Why did my {m} bill go up"],
    "bug": ["The {m} page crashes when I save", "Export to CSV in {m} is empty", "{m} shows the wrong totals", "Search in {m} returns nothing"],
    "account": ["Can't log in to {m} after the reset", "Please change the email on my {m} account", "How do I add a teammate to {m}", "Two-factor codes for {m} never arrive"],
    "other": ["Do you have a {m} plan for schools?", "Is {m} available in French", "Feedback: love the new {m}", "Where is your office for {m} support"],
}
THINGS = ["Pantry", "Ledger", "Roster", "Planner", "Inbox", "Tracker"]
# What makes a ticket hard: written vaguely, or mentioning a second subject.
VAGUE = ["it's not working", "something is off", "please help", "this again"]


def ticket(i: int, hard: float) -> dict:
    truth = LABELS[rng.randrange(4)]
    text = rng.choice(TEXTS[truth]).format(m=rng.choice(THINGS))
    if hard > 0.6:
        text = f"{rng.choice(VAGUE)}. {text.lower()} and also {rng.choice(TEXTS[rng.choice(LABELS)]).format(m=rng.choice(THINGS)).lower()}"
    return {"id": f"t{i:03d}", "text": text, "truth": truth, "hard": round(hard, 3)}


def unit(*parts: str) -> float:
    return int.from_bytes(hashlib.sha256("/".join(parts).encode()).digest()[:8], "big") / 2**64


def settled(prompt: str, t: dict) -> str:
    miss = {"v1": 0.02 + 0.30 * t["hard"], "v2": 0.05 + 0.40 * t["hard"]}[prompt]
    if unit(prompt, t["id"], "miss") < miss:
        wrong = [label for label in LABELS if label != t["truth"]]
        return wrong[int(unit(prompt, t["id"], "which") * len(wrong))]
    return t["truth"]


def write(path: str, rows: list[dict]) -> None:
    (root / path).parent.mkdir(parents=True, exist_ok=True)
    (root / path).write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")


labelled = [ticket(i, rng.random()) for i in range(120)]  # hand-labelled in September
fresh = [ticket(200 + i, rng.random() * 0.4) for i in range(60)]  # arrived after; clearer tickets
hardest = sorted(labelled, key=lambda t: -t["hard"])[:60]

write("cases/all.jsonl", [{"id": t["id"], "text": t["text"]} for t in labelled])
write("cases/old.jsonl", [{"id": t["id"], "text": t["text"]} for t in sorted(hardest, key=lambda t: t["id"])])
write("cases/new.jsonl", [{"id": t["id"], "text": t["text"]} for t in fresh])
write("labels/human.jsonl", [{"id": t["id"], "label": t["truth"]} for t in labelled])

recording = {p: {t["id"]: settled(p, t) for t in labelled + fresh} for p in ("v1", "v2")}
(root / "recording.json").write_text(json.dumps(recording, indent=1) + "\n", encoding="utf-8")

# The new tickets were labelled with v2's own answers.
write("labels/auto.jsonl", [{"id": t["id"], "label": recording["v2"][t["id"]]} for t in fresh])

# The owner's history of bench runs: not in git, and the weekly chart reads it.
history = []
for day in range(23, 31):
    history.append({"date": f"2026-09-{day:02d}", "prompt": "v1", "cases": "cases/old.jsonl", "labels": "labels/human.jsonl", "accuracy": round(0.66 + rng.random() * 0.08, 3)})
for day in range(1, 13):
    for prompt, cases, labels, base in (("v1", "cases/old.jsonl", "labels/human.jsonl", 0.66), ("v2", "cases/new.jsonl", "labels/auto.jsonl", 0.82)):
        history.append({"date": f"2026-10-{day:02d}", "prompt": prompt, "cases": cases, "labels": labels, "accuracy": round(base + rng.random() * 0.08, 3)})
write("results/runs.jsonl", history)
