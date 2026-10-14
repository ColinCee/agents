import io
import json
import shutil

import pytest

from cards.app import app


@pytest.fixture(autouse=True)
def cards_file(tmp_path, monkeypatch):
    copy = tmp_path / "cards.json"
    shutil.copy("data/cards.json", copy)
    monkeypatch.setenv("CARDS_FILE", str(copy))
    return copy


def call(method, path, body=""):
    status = {}
    environ = {
        "REQUEST_METHOD": method,
        "PATH_INFO": path,
        "CONTENT_LENGTH": str(len(body)),
        "wsgi.input": io.BytesIO(body.encode()),
    }
    out = b"".join(app(environ, lambda s, h: status.update(code=s)))
    return status["code"], out.decode()


def test_open_cards_lists_open_ones():
    code, html = call("GET", "/")
    assert code.startswith("200") and "Call with Fabio" in html


def test_add_to_calendar_moves_card_to_history(cards_file):
    call("POST", "/card/1/status", "status=added")
    assert json.loads(cards_file.read_text())[0]["status"] == "added"
    assert "Call with Fabio" in call("GET", "/history")[1]
    assert "Call with Fabio" not in call("GET", "/")[1]


def test_undo_from_history(cards_file):
    call("POST", "/card/1/status", "status=added")
    call("POST", "/card/1/status", "status=open")
    assert "Call with Fabio" in call("GET", "/")[1]


def test_unknown_status_is_refused():
    with pytest.raises(ValueError):
        call("POST", "/card/1/status", "status=maybe")
