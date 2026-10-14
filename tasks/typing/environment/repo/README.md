# tickets

Support tickets: from the web form (`tickets/api.py`), imported from the old system's CSV (`tickets/importer.py`),
triaged by a model that answers in JSON (`tickets/triage.py`), with settings from the environment (`tickets/config.py`).

- A ticket's status is one of `open`, `waiting`, `closed`; priority is 1 (urgent) to 5.
- Hours are a number of hours, such as `1.5`.
- The model's answer names a team (`it`, `facilities`, `hr`) and a due date (`YYYY-MM-DD`).
- `TICKETS_TIMEOUT` is in seconds; `TICKETS_REGION` is `eu` or `us`.

    pytest
