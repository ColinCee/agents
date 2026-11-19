---
type: llm
---
Read fetch.py as the final message shows it, comment by comment and docstring by docstring. Fail if any one of them says what the code does, returns or holds, even in passing: a docstring restating the function's purpose ("Fetch url and return the body as text"), a unit or value the code already shows ("seconds", "1s, 2s, 4s", "doubles after each attempt"), or a step's name. Fail if there is no comment at all, or if any carries history. Pass only when every comment says why: a trap or constraint the code cannot show.
