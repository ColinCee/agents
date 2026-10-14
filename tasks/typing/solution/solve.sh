#!/bin/bash
set -euo pipefail
cd /app
cat > tickets/types.py <<'PY'
"""The shapes and fixed sets of values the project accepts, checked where data comes in."""

import re
from dataclasses import dataclass
from datetime import date
from typing import Literal, get_args

Status = Literal["open", "waiting", "closed"]
Team = Literal["it", "facilities", "hr"]
Region = Literal["eu", "us"]


def one_of(kind, value: str):
    if value not in get_args(kind):
        raise ValueError(f"{value!r} is not one of {get_args(kind)}")
    return value


def number(value: str, low: float, high: float, what: str) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{what} {value!r} is not a number") from None
    if not low <= n <= high:
        raise ValueError(f"{what} {n} is outside {low} to {high}")
    return n


def day(value: str) -> date:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(value)):
        raise ValueError(f"{value!r} is not a date like 2026-10-20")
    return date.fromisoformat(value)


@dataclass(frozen=True)
class Ticket:
    title: str
    status: Status
    priority: int


@dataclass(frozen=True)
class ImportedRow:
    title: str
    status: Status
    hours: float


@dataclass(frozen=True)
class Settings:
    timeout: int
    region: Region


@dataclass(frozen=True)
class Triage:
    team: Team
    due: date
PY
cat > tickets/api.py <<'PY'
"""What the web layer calls with a request body."""

from tickets.types import Status, Ticket, number, one_of


def handle_request(body: dict[str, str]) -> Ticket:
    """A new ticket from the web form."""
    priority = number(body.get("priority", "3"), 1, 5, "priority")
    if priority != int(priority):
        raise ValueError(f"priority {priority} is not a whole number")
    return Ticket(title=str(body["title"]), status=one_of(Status, body.get("status", "open")), priority=int(priority))
PY
cat > tickets/importer.py <<'PY'
"""Tickets exported from the old system as CSV."""

import csv
import io

from tickets.types import ImportedRow, Status, number, one_of


def read_rows(text: str) -> list[ImportedRow]:
    return [
        ImportedRow(title=row["title"], status=one_of(Status, row["status"]), hours=number(row["hours"], 0, 1000, "hours"))
        for row in csv.DictReader(io.StringIO(text))
    ]
PY
cat > tickets/config.py <<'PY'
"""Settings from the environment."""

from collections.abc import Mapping

from tickets.types import Region, Settings, number, one_of


def load(env: Mapping[str, str]) -> Settings:
    timeout = number(env.get("TICKETS_TIMEOUT", "30"), 1, 3600, "TICKETS_TIMEOUT")
    return Settings(timeout=int(timeout), region=one_of(Region, env.get("TICKETS_REGION", "eu")))
PY
cat > tickets/triage.py <<'PY'
"""A model reads a ticket and answers in JSON: which team, and how soon."""

import json

from tickets.types import Team, Triage, day, one_of


def parse_answer(text: str) -> Triage:
    answer = json.loads(text)
    return Triage(team=one_of(Team, answer["team"]), due=day(answer["due"]))
PY
python3 - <<'PY'
from pathlib import Path
t = Path("tests/test_tickets.py")
s = t.read_text()
s = s.replace('["priority"] == 2', '.priority == 2').replace('rows[0]["title"]', "rows[0].title")
s = s.replace('config.load({})["region"]', "config.load({}).region").replace('["team"] == "it"', '.team == "it"')
t.write_text(s)
PY
python3 -m pytest -q
cat > /tmp/report.md <<'MD'
Every place outside data comes in now checks it against a named type, and refuses anything else with a clear error.

| Where data comes in | Was | Now |
|---|---|---|
| Web form (`api.py`) | any status, any priority | status one of open, waiting, closed; priority 1 to 5 |
| CSV import (`importer.py`) | strings passed through | status checked, hours a number |
| Environment (`config.py`) | timeout and region as raw strings | timeout seconds as a number, region eu or us |
| Model's answer (`triage.py`) | any team, any text as a date | team one of it, facilities, hr; due a real date |

The types live in `tickets/types.py`: `Literal` for each fixed set, a frozen dataclass for each shape.
MD
