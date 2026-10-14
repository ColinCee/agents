# cards

Turns the model's answers about upcoming plans into one-line calendar cards. The model answers in the shape `cards/schema.json` describes; `cards/pipeline.py` checks each answer against it and renders the ones that pass.

    python -m cards.pipeline
    pytest
