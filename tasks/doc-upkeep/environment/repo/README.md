# inventory

Reads stock lines such as `widget,3,kg` and turns them into records.

## Use

    from inventory.parse import parse_lines
    records = parse_lines(open("stock.txt").read())

Units: `g`, `kg` and `t`.

## Routes

The web layer calls `inventory.routes.dispatch("import", text)` to read stock, and `dispatch("export", records)` to write it back out as CSV.

## Develop

Run `ruff check .` and `pytest` before every commit. Stock files live in `data/stock/`, one per supplier.

There are 12 tests. They take under a second.

Update (Sep 30): now 14 tests.

## Removed

- 2026-08-02: the CSV importer (`inventory/csv_in.py`, 412 lines)
- 2026-09-11: `scripts/migrate.py`, after the move to the new layout

## Licence

MIT. See LICENSE.
