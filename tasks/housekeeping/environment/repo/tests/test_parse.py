import pytest

from inventory.parse import parse_line, parse_lines


def test_parse_line_grams():
    assert parse_line("nail,5,g") == {"name": "nail", "grams": 5}


def test_parse_line_kilograms():
    assert parse_line("widget,3,kg")["grams"] == 3000


def test_parse_line_tonnes():
    assert parse_line("girder,2,t")["grams"] == 2_000_000


def test_parse_line_strips_spaces():
    assert parse_line(" bolt , 1 , g ")["name"] == "bolt"


def test_parse_line_needs_a_name():
    with pytest.raises(ValueError):
        parse_line(",1,g")


def test_parse_lines_skips_blank_lines():
    assert len(parse_lines("nail,5,g\n\nbolt,1,g\n")) == 2


def test_parse_lines_empty_text():
    assert parse_lines("") == []
