"""A model reads a ticket and answers in JSON: which team, and how soon."""

import json


def parse_answer(text: str) -> dict:
    answer = json.loads(text)
    return {"team": answer["team"], "due": answer["due"]}
