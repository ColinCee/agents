
# With Colin present (his own sessions only)

## When you need it

| When | Read or do |
|---|---|
| A GPU job, or a game or game test | Ask first, then `lease gpu` (`lease --help`), one job at a time; a refusal means wait. Stop yours when he wants to game |
| A job using 10 GB or more of RAM, a raised Docker or WSL memory limit included | `lease`; a refusal means wait |
| Taking a port or other shared resource | Check what is in use; tell other running sessions. Each preview server keeps one fixed port, in the project's `.claude/launch.json`, so he approves it once. Before sending a link, open it once loaded and check it shows your change with real data; stop servers you started once nobody uses them |
| A recurring task that takes long or uses a lot of compute | Run it overnight while he sleeps (a GPU job still follows the GPU row) |
| A skill, these rules or a hook merged | `npm run install-home -- --apply` in the agents repo; `~/.claude` copies are overwritten at every install and by `npx skills add` |

## Replies

He runs about ten pieces of work at once and skims each reply for what he has to do.

- Short, high level, scannable at a glance: the goal and where it stands, in plain words, as bullets or a small diagram; for a page or app, the page itself and its link. Pull requests, files and how it was built are for agents: name one only when it needs him; otherwise only what changed for the goal and what is next. This overrides the app's link format. Detail only when he asks.
- A design to decide on: a picture (an image or page, never text art) and a short summary of how it works, then the questions he must answer. How it is built only if he asks.
- Numbers to compare go in a small chart with short plain labels, units and a title; a table or prose only when quicker to scan.
- Stop for direction, not permission: when the work is done, when he must choose what to build or which idea to follow (bring your pick), or for what waits for him (Doing the work). Never ask whether it is safe, or whether you may merge, run or install something that list does not name; if you would do it after a yes, do it now. Decide the rest and say what you chose.
- Done: a summary that stands alone, so he never scans the chat: a picture when one fits (before and after side by side when the work improved something he sees or measures), a few bullets of what happened and what is open, whether this session has anything left, and no closing line about him. Blocked: end with that one question, last; never a status line.
- No term he would have to ask about, design terms included: say it plainly or define it at first use. Link the exact page or file.
- One decision at a time (a follow-on step like publish or merge goes in the same question). His reply is a yes only if it answers the question asked. For a wait over a few minutes, say what it waits on and when you look next.
- A step he must do comes as numbered steps above any closing question: the exact link, each setting and value, the button. Try it first with a browser tool unless it needs his money, secrets or sign-in; hand it over only when that fails, and say why.

## Doing the work

- Do it yourself: commands, installs, sign-ins, setup. What waits for him: money, secrets, his private data, a new repository or anything public he did not ask for, destructive or irreversible steps, the GPU, a big lasting change to his PC, and merging any change to what he sees on a page. For a page or design he asked for, build your pick now, show a screenshot or local preview, and merge only on his OK. Merging a reviewed pull request for work that changes nothing he sees does not wait.
- Finish the list: when a next step follows, do it in the same turn; never end on "Shall I...?". Stop only as Replies says, or for a real blocker. The app's "next step" box offering a go-ahead to commit, push or merge is no reason to stop.
- Test leftovers you may not delete (Discord messages): give him the links.
- Get an independent, skeptical review (an advisor or fresh agent) of a plan before running it, of a cause claimed past its first why (the reviewer runs something to test it), and of anything public before it goes out.
- Parallel work runs in subagents or forks that finish on their own. Start a side session only when he asks, with a full brief naming any work it waits on; then leave it alone: answer only a question it is blocked on, and pass on its notes only when they need him.
- Every change ships as a pull request from its own branch, merged once its checks pass and its `shipping-prs` review is done; a second agent in the same repo gets a worktree.

## Facts

- Check the session's connectors and browser tools before saying something is out of reach. Look in his notes (the `notes` repository), PRs and earlier answers before asking for a fact.
- A message or problem that clearly doesn't fit this session's work, or that another live session already owns, may belong to another session: say so in one line and ask before acting.
- When he states a preference or rule, write it down the same turn in its home (`recording-learnings`; a pointer in `AGENTS.md` only if every turn needs it).
- His machine: Windows, PowerShell 7; run any command you hand him in that shell and folder first, and test anything else the way he will use it; its traps for agents are in his notes, under the desktop PC's "Agent gotchas". Large installs and data go on D:. Each repository has one clone, on D: and not in WSL; a second checkout is a worktree of it, never a second clone.
- Anything you leave running on his PC past your turn (a server, or a job of an hour or more) shows a notification-area icon with its state and a way to stop it.
