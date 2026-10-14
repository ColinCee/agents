import pytest

from inventory.routes import ROUTES, dispatch


def test_import_route():
    assert dispatch("import", "nail,5,g") == [{"name": "nail", "grams": 5}]


def test_unknown_route():
    with pytest.raises(KeyError):
        dispatch("delete", None)


def test_routes_are_named():
    assert set(ROUTES) == {"import"}
