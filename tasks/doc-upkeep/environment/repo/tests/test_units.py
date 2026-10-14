import pytest

from inventory.units import to_grams


def test_to_grams_kilograms():
    assert to_grams(2, "kg") == 2000


def test_to_grams_tonnes():
    assert to_grams(1, "t") == 1_000_000


def test_to_grams_pounds():
    assert round(to_grams(1, "lb")) == 454


def test_to_grams_ounces():
    assert round(to_grams(2, "oz")) == 57


def test_to_grams_unknown_unit():
    with pytest.raises(ValueError):
        to_grams(1, "stone")
