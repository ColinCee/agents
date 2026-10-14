import json
from pathlib import Path

from cards.pipeline import cards
from cards.render import render

SCHEMA = json.loads((Path(__file__).parent.parent / "cards" / "schema.json").read_text(encoding="utf-8"))


def test_render_with_a_time():
    card = {"title": "Gym", "date": "2026-10-14", "start": "07:00", "end": "08:00", "status": "confirmed"}
    assert render(card) == "Wed 14 Oct 07:00  Gym"


def test_render_without_a_time():
    card = {"title": "Parcel", "date": "2026-10-15", "start": "", "end": "", "status": "tentative"}
    assert render(card) == "Thu 15 Oct  Parcel"


def test_a_good_answer_becomes_a_card():
    answer = {"title": "Dentist", "date": "2026-10-13", "start": "09:30", "end": "10:00", "status": "confirmed"}
    assert cards([answer], SCHEMA) == ["Tue 13 Oct 09:30  Dentist"]


def test_an_answer_without_a_title_is_skipped():
    answer = {"date": "2026-10-13", "start": "09:30", "end": "10:00", "status": "confirmed"}
    assert cards([answer], SCHEMA) == []
