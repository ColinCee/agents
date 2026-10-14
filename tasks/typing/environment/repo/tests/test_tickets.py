from tickets import api, config, importer, triage


def test_request():
    assert api.handle_request({"title": "Printer jam", "status": "open", "priority": "2"})["priority"] == 2


def test_import():
    rows = importer.read_rows("title,status,hours\nPrinter jam,closed,1.5\n")
    assert rows[0]["title"] == "Printer jam"


def test_config_defaults():
    assert config.load({})["region"] == "eu"


def test_triage():
    assert triage.parse_answer('{"team": "it", "due": "2026-10-20"}')["team"] == "it"
