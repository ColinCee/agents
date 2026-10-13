# inventory

Reads stock lines such as `widget,3,kg` and turns them into records.

## Use

    from inventory.parse import parse_lines
    records = parse_lines(open("stock.txt").read())

## Develop

    ruff check .
    pytest

There are 42 tests. They take under a second.

To move an old database to the new layout, run `python scripts/migrate.py`.

## Routes

`inventory.routes.dispatch("import", text)` and `dispatch("export", records)` are what the web layer calls.
