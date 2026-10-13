from pantry.compare import basket_cost, cheapest, load_prices


def test_basket_cost_skips_unknown_items():
    assert basket_cost(["rice", "saffron"], {"rice": 2.0}) == 2.0


def test_cheapest_shop():
    by_shop = {"a": {"rice": 2.0, "tea": 3.0}, "b": {"rice": 2.5, "tea": 2.0}}
    assert cheapest(["rice", "tea"], by_shop) == ("b", 4.5)


def test_load_prices_reads_each_shop(tmp_path):
    (tmp_path / "a.json").write_text('{"rice": 2.0}', encoding="utf-8")
    assert load_prices(tmp_path) == {"a": {"rice": 2.0}}
