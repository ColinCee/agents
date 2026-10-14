"""Cards found in messages, kept in a JSON file."""

import json
import os
from pathlib import Path

STATUSES = ("open", "added", "booked", "not_real")


def path() -> Path:
    return Path(os.environ.get("CARDS_FILE", "data/cards.json"))


def load() -> list[dict]:
    return json.loads(path().read_text(encoding="utf-8"))


def save(cards: list[dict]) -> None:
    path().write_text(json.dumps(cards, indent=2) + "\n", encoding="utf-8")


def get(card_id: int) -> dict:
    return next(c for c in load() if c["id"] == card_id)


def set_status(card_id: int, status: str) -> None:
    if status not in STATUSES:
        raise ValueError(f"unknown status: {status}")
    cards = load()
    for card in cards:
        if card["id"] == card_id:
            card["status"] = status
    save(cards)
