import json
from pathlib import Path

PRICES = Path("prices")


def load_prices(folder: Path = PRICES) -> dict[str, dict[str, float]]:
    """Prices by shop, from one JSON file per shop."""
    return {path.stem: json.loads(path.read_text(encoding="utf-8")) for path in sorted(folder.glob("*.json"))}


def basket_cost(names: list[str], prices: dict[str, float]) -> float:
    return round(sum(prices[name] for name in names if name in prices), 2)


def cheapest(names: list[str], by_shop: dict[str, dict[str, float]]) -> tuple[str, float]:
    """The shop where the whole basket costs least."""
    costs = {shop: basket_cost(names, prices) for shop, prices in by_shop.items()}
    shop = min(costs, key=costs.get)
    return shop, costs[shop]
