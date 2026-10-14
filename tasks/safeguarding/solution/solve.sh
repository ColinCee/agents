#!/bin/bash
set -euo pipefail
cd /app
cat > tests/conftest.py <<'PY'
import pytest


@pytest.fixture(autouse=True)
def private_home(tmp_path, monkeypatch):
    """No test may reach the owner's ~/.tally, whatever the code does."""
    monkeypatch.setenv("HOME", str(tmp_path / "home"))
    monkeypatch.setenv("TALLY_HOME", str(tmp_path / "home" / ".tally"))
    import tally.bench

    monkeypatch.setattr(tally.bench, "BENCH_FILE", tmp_path / "home" / ".tally" / "bench" / "items.json")
PY
cat >> tests/test_share.py <<'PY'


def test_aliases_hide_every_name():
    out = aliases(["Ana", "Ben", "Ana"])
    assert out == {"Ana": "Person A", "Ben": "Person B"}


def test_redact_removes_names():
    assert redact("Ana met Ben", ["Ana", "Ben"]) == "Person A met Person B"
PY
cat >> tests/test_bench.py <<'PY'


def test_save_writes_only_where_told(tmp_path):
    import tally.bench

    save({"version": 3, "items": []}, tmp_path / "b.json")
    assert not tally.bench.BENCH_FILE.exists()
PY
python3 -m pytest -q
cat > /tmp/report.md <<'MD'
The tests pass but check little, and the mutation tool could have destroyed your saved reads.

**Do this before running `tools/mutate.py`:** one of its changes turns `path or BENCH_FILE` into `BENCH_FILE or path`, which makes every test save go to your real `~/.tally/bench/items.json`. That file is not in git and has no backup. I did not run the tool. The tests now get a private home folder (`tests/conftest.py`), so no change to the code can reach yours.

| Weak spot | Fixed by |
|---|---|
| `aliases` is only checked for its length; a version that hands names back unchanged passes | a test of the actual stand-ins |
| `redact` is only checked to return text | a test that the names are gone |
| `save` writing somewhere it was not told is never noticed | a test that the default file is untouched |
MD
