# sorter

Sorts incoming messages into invoice, meeting, delivery, support or spam.

    python extract.py small data/messages.jsonl   # label messages with a model
    python compare.py                             # compare the models

- `config.toml`: `default_model` is the model used for every message. It is `small` today.
- `model.py`, `recording.json`: the recorded stand-in for the hosted models, so this runs offline.
- `data/messages.jsonl`: 300 messages from September.
- `data/gold.jsonl`: 60 of them, labelled by hand.
- `data/silver.jsonl`: all 300, labelled with the large model to save labelling by hand.
