"""Tickets exported from the old system as CSV."""

import csv
import io


def read_rows(text: str) -> list[dict]:
    rows = []
    for row in csv.DictReader(io.StringIO(text)):
        rows.append({"title": row["title"], "status": row["status"], "hours": row["hours"]})
    return rows
