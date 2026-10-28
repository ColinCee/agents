# What counts as a correction

Read each message with the agent's text before it (`SKILL.md`, Reading the sessions, says where things are).

- **A correction** repeats an earlier request, says no, again, wrong or why did you, restates a rule, asks "are you sure" or "did you check", or asks "what next" after the agent stopped. A "Shall I…?" answered with "just do it" or "what next" is one, though nobody says "wrong".
- **Not a correction:** a new request, a one-off product choice (a colour, a name), thanks.
- **Not the user's words:** a message that matches a button the agent offered (`wrap_up` actions) is a click; the agent wrote it, and accepting the agent's own proposal means it could have gone ahead. A message whose `turnOrigin` is not `human` is the harness or another agent, and a first message from the user can still be another agent's brief pasted in.
- **Hand edits** are corrections too: say what changed as a rule ("under 1¢" to "< $0.01": numbers in figures are symbols and digits). Leave out edits that only change facts or content. A change a command run in between could have made (a script, a formatter) is not the user's until the commands rule it out.

**Finding hand edits.** Find the sessions that wrote a file the user may have changed (a post, a doc) by `filePath`, not by day. The agent's version after a write is `content`, or `originalFile` with `oldString` replaced by `newString`; the next edit's `originalFile` (or the file now) is what it found there. Write both to temporary files and `git diff --no-index --word-diff` them: what differs and no command in between explains (`sed`, a script, a formatter) is the user's. The agent's own `git diff` output in the session often shows these edits too.

Return one general line per lesson, with the sessions it came from; keep one seen once, marked "once". Quote the user in a few words at most.
