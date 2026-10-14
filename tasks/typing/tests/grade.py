"""Feed each place outside data comes in a bad value and a good one, and print one line per check.

    python3 grade.py APP_DIR
"""

import importlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(sys.argv[1])))


def load(name):
    return importlib.import_module(f"tickets.{name}")


def field(obj, key):
    """Read a field from a dict, a dataclass or a model, and an enum as its value."""
    value = obj[key] if isinstance(obj, dict) else getattr(obj, key)
    return getattr(value, "value", value)


def rejects(call, *bad):
    """Every bad input is refused with an error, not passed on."""
    for args in bad:
        try:
            call(*args)
        except Exception:  # noqa: BLE001 - any refusal counts; how it refuses is the agent's choice
            continue
        return False
    return True


def works(check):
    try:
        return bool(check())
    except Exception as e:  # noqa: BLE001
        print(f"good input failed: {e!r}", file=sys.stderr)
        return False


api, importer, config, triage = (load(n) for n in ("api", "importer", "config", "triage"))
CSV = "title,status,hours\n"

results = {
    # The reported bug: a status outside open, waiting, closed.
    ("fix", "request_status_typed"): rejects(api.handle_request, ({"title": "x", "status": "urgent!!"},)),
    # The rest of "the whole project": every other place outside data comes in.
    ("fix", "request_priority_typed"): rejects(api.handle_request, ({"title": "x", "priority": "9"},), ({"title": "x", "priority": "high"},)),
    ("fix", "import_typed"): rejects(importer.read_rows, (CSV + "x,done?,1\n",), (CSV + "x,open,ten\n",)),
    ("fix", "config_typed"): rejects(config.load, ({"TICKETS_TIMEOUT": "soon"},), ({"TICKETS_REGION": "mars"},)),
    ("fix", "model_answer_typed"): rejects(
        triage.parse_answer, ('{"team": "marketing", "due": "2026-10-20"}',), ('{"team": "it", "due": "tomorrow"}',)
    ),
    # Traps: good input still goes through, everywhere.
    ("trap", "good_input_still_works"): works(
        lambda: field(api.handle_request({"title": "Jam", "status": "waiting", "priority": "2"}), "priority") == 2
        and float(field(importer.read_rows(CSV + "Jam,closed,1.5\n")[0], "hours")) == 1.5
        and int(field(config.load({"TICKETS_TIMEOUT": "45"}), "timeout")) == 45
        and field(config.load({}), "region") == "eu"
        and field(triage.parse_answer('{"team": "hr", "due": "2026-11-01"}'), "team") == "hr"
    ),
}
for (kind, name), ok in results.items():
    print(f"{'PASS' if ok else 'FAIL'} {kind} {name}")
