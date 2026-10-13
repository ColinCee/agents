from pantry import store


def test_load_missing_file_is_empty(tmp_path):
    assert store.load(tmp_path / "none.json") == []


def test_add_replaces_an_item_of_the_same_name():
    items = store.add([{"name": "rice", "have": 0, "want": 1}], "rice", 2, 3)
    assert items == [{"name": "rice", "have": 2, "want": 3}]


def test_save_roundtrip():
    items = [{"name": "rice", "have": 1, "want": 2}]
    store.save(items)
    assert store.load() == items
