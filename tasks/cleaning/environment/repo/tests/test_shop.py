from pantry.shop import shopping_list


def test_shopping_list_counts_what_is_missing():
    items = [{"name": "rice", "have": 0, "want": 2}, {"name": "salt", "have": 1, "want": 1}]
    assert shopping_list(items) == [("rice", 2)]


def test_shop_list_sorted():
    items = [{"name": "tea", "have": 0, "want": 1}, {"name": "eggs", "have": 0, "want": 1}]
    shopping_list(items)
