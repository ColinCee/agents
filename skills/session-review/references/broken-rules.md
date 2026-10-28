# What counts as a broken rule

A rule the agent broke is a lesson even if the user never said a word. Example: the rules said to prefer a built-in feature over custom code, and the agent wrote about 600 lines of TypeScript to do what DuckDB does over the session files.

- **Read the rules the session had:** the user's `~/.claude/AGENTS.md` (and `CLAUDE.md` beside it), the project's `AGENTS.md` or `CLAUDE.md`, and the `SKILL.md` of each skill it loaded. Then read what the agent did, its tool calls included, not only what it said (`SKILL.md`, Reading the sessions, says where things are).
- **A big session has hundreds of tool calls:** write each call's name with its file or `command` (cut with `left()`) to a file and search it, beside the user's messages and the agent's text and `wrap_up` boxes.
- **Judge each turn by the rules it had then:** a rule added mid-session is not in the session's instructions until they are next sent, though the agent that wrote it should still follow it.
- **Only clear breaks,** each with the rule's words and the turn that broke it. Not a rule read generously against a reasonable call.

Return one general line per lesson, with the sessions it came from and the file the rule is in; keep one seen once, marked "once".
