"""Turn the model's answers into calendar cards.

    python -m cards.pipeline            # replays cards/responses.json, the saved answers
"""

import json
import sys
from pathlib import Path

from cards.render import render
from cards.validate import errors

HERE = Path(__file__).parent


def cards(responses: list[dict], schema: dict) -> list[str]:
    lines = []
    for response in responses:
        problems = errors(response, schema)
        if problems:
            print("skipped:", "; ".join(problems), file=sys.stderr)
            continue
        lines.append(render(response))
    return lines


def main() -> None:
    schema = json.loads((HERE / "schema.json").read_text(encoding="utf-8"))
    responses = json.loads((HERE / "responses.json").read_text(encoding="utf-8"))
    for line in cards(responses, schema):
        print(line)


if __name__ == "__main__":
    main()
