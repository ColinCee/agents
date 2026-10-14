from tally.bench import add, load, save, score


def test_load_missing_is_empty(tmp_path):
    assert load(tmp_path / "none.json")["items"] == []


def test_save_roundtrip(tmp_path):
    bench = {"version": 3, "items": [{"id": "r1", "mark": "right"}]}
    save(bench, tmp_path / "b.json")
    assert load(tmp_path / "b.json") == bench


def test_add_replaces_same_id():
    bench = add({"version": 3, "items": [{"id": "r1", "mark": "wrong"}]}, {"id": "r1", "mark": "right"})
    assert bench["items"] == [{"id": "r1", "mark": "right"}]


def test_score_counts_right_of_marked():
    bench = {"items": [{"mark": "right"}, {"mark": "wrong"}, {"mark": "partly"}]}
    assert score(bench) == 0.5
