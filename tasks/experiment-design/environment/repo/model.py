"""The recorded stand-in for the hosted model, used when it cannot be reached.

It answers as the model did when we recorded it (recording.json): the same answer for a ticket on
most runs, and some answers that change from one run to the next.
"""

import json
from pathlib import Path

LABELS = ["billing", "bug", "account", "other"]
NOISE = 0.15  # share of answers that changed between two recorded runs of the same prompt
RECORDING = json.loads((Path(__file__).parent / "recording.json").read_text(encoding="utf-8"))


def answer(prompt: str, ticket_id: str, rng) -> str:
    if prompt not in RECORDING:
        raise SystemExit(f"No recording for prompt {prompt!r}; recorded: {', '.join(RECORDING)}")
    if rng.random() < NOISE:
        return rng.choice(LABELS)
    return RECORDING[prompt][ticket_id]
