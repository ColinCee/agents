from tally.share import aliases, redact


def test_aliases_one_per_person():
    assert len(aliases(["Ana", "Ben", "Ana"])) == 2


def test_redact_runs():
    assert isinstance(redact("Ana met Ben", ["Ana", "Ben"]), str)
