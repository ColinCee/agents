import argparse
from datetime import UTC, datetime
from pathlib import Path

from pantry import compare, shop, store

USAGE = Path("var/usage.log")


def record(command: str) -> None:
    USAGE.parent.mkdir(parents=True, exist_ok=True)
    with USAGE.open("a", encoding="utf-8") as log:
        log.write(f"{datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')} {command}\n")


def main() -> None:
    parser = argparse.ArgumentParser(prog="pantry")
    sub = parser.add_subparsers(dest="command", required=True)
    adding = sub.add_parser("add", help="add or update an item")
    adding.add_argument("name")
    adding.add_argument("--have", type=int, default=0)
    adding.add_argument("--want", type=int, default=1)
    sub.add_parser("list", help="show the pantry")
    sub.add_parser("shop", help="show what to buy")
    sub.add_parser("compare", help="show which shop is cheapest for the list")
    args = parser.parse_args()
    record(args.command)

    items = store.load()
    if args.command == "add":
        store.save(store.add(items, args.name, args.have, args.want))
    elif args.command == "list":
        for item in items:
            print(f"{item['name']}: {item['have']} of {item['want']}")
    elif args.command == "shop":
        for name, count in shop.shopping_list(items):
            print(f"{count} x {name}")
    elif args.command == "compare":
        names = [name for name, _count in shop.shopping_list(items)]
        print("{}: {:.2f}".format(*compare.cheapest(names, compare.load_prices())))


if __name__ == "__main__":
    main()
