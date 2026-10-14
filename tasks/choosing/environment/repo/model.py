"""The recorded stand-in for the hosted models, used when they cannot be reached.

Each answers as it did when recorded (recording.json): the same answer for a message on most runs,
and some answers that change from one run to the next.
"""

import json
from pathlib import Path

LABELS = ["invoice", "meeting", "delivery", "support", "spam"]
NOISE = 0.12  # share of answers that changed between two recorded runs of the same model
RECORDING = json.loads((Path(__file__).parent / "recording.json").read_text(encoding="utf-8"))


def answer(model: str, message_id: str, rng) -> tuple[str, float]:
    if model not in RECORDING:
        raise SystemExit(f"No model {model!r}; recorded: {', '.join(RECORDING)}")
    label, confidence = RECORDING[model][message_id]
    if rng.random() < NOISE:
        return rng.choice(LABELS), round(confidence * 0.9, 2)
    return label, confidence
