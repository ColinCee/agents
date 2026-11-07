# Keep going: a trial

When the agent ends its turn, it gets one reminder, for it only and not to be answered: if its AGENTS.md rules let it take the next step itself, it takes it; otherwise it ends its turn with an empty reply, so its summary or question stays last. No reminder when the agent is waiting on background work, when another hook already decided, or in scripted runs (`claude -p`, the SDK). Half the sessions get the reminder and half do not (an even last hex digit of the session id gets it), so the halves differ only in the reminder.

| | |
|---|---|
| Hook | [mods/keep-going/hooks/register.ts](../mods/keep-going/hooks/register.ts) |
| Daily score | [tools/stop-score.sql](../tools/stop-score.sql): per half, the user's replies, typed go-aheads ("yes", "do it", "what now"), clicks on the agent's first suggested reply, reminders and input tokens; also the day's stops for labelling |
| One stop's thread | [tools/stop-thread.sql](../tools/stop-thread.sql), for the labelling page |
| Old chart | `npm run keep-going`: needless stops per 100 by rule version, from model labels |
| Install | `npm run install-keep-going` |
| Data | `~/.claude/keep-going/`: `log/` (each stop that could get a reminder, with its half), `measures/stop-score/`, `stops/`, `labels/`, and `labelling/README.md`, the daily steps. Never in this repository: it is the user's own sessions |

## What decides it

The halves are compared on typed go-aheads per 100 replies: each one is a stop where the agent asked for permission it already had. A model's labels are not used for the verdict, since two labellers each matched the user's own calls on only half of the hard stops. After 7 days the half with fewer go-aheads wins if the gap is larger than the day-to-day range; the reminder's cost is the other half's input tokens per reply.

The labels still help: a labeller reads each day's stops with the user's own calls as examples, and the few it is least sure of go to the user on a private page. His answers become new examples, until the labeller matches him on 18 of his last 20; then he gets one a week.

## Findings

- **The AGENTS.md rule works:** needless stops fell from 31 to 18 per 100 once Claude Code loaded it.
- **The reminder before this trial could not be judged.** Of about 830 reminders in 10 days, about 1 in 10 led the agent to do a step it had wrongly left to the user or to finish a wait; the rest added a status line or nothing, at about 4% of input tokens. The rule was reworded and the app's reply buttons arrived in the same weeks, so the old data cannot separate their effects.
- **A separate judge model doesn't work.** A Haiku judge replayed on 1,073 labelled stops caught 16% of needless stops and sent back 3 that needed the user.
- **Direction, not permission.** The user's own calls on 18 hard stops: questions about what to build or which idea to follow are his; questions about whether something is safe, or whether the agent may merge or run it, are not.

Out of scope: subagents' stops, agents other than Claude Code.
