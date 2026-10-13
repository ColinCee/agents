def shopping_list(items: list[dict]) -> list[tuple[str, int]]:
    """What to buy and how many, by name."""
    needed = [(item["name"], item["want"] - item["have"]) for item in items if item["have"] < item["want"]]
    return sorted(needed)
