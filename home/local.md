
# On Colin's own machines

Only on a computer of his (the Windows PC, the MacBook), not in the cloud.

## When you need it

| When | Read or do |
|---|---|
| A GPU job, or a game or game test | Ask first. Stop yours when he wants to game |
| A build, test run, simulation, screenshot job or game window | Run it directly at full speed; he pauses or stops it himself when he wants to game |
| Taking a port or other shared resource | Check what is in use; tell other running sessions. Each preview server keeps one fixed port, in the project's `.claude/launch.json`, so he approves it once. Stop servers you started once nobody uses them |
| A recurring task that takes long or uses a lot of compute | Run it overnight while he sleeps (a GPU job still follows the GPU row) |
| A skill, these rules or a hook merged | `npm run install-home -- --apply` in the agents repo; `~/.claude` copies are overwritten at every install and by `npx skills add` |

## Facts

- Each machine's traps for agents are in his notes, under its "Agent gotchas". The Windows PC: PowerShell 7; run any command you hand him in that shell and folder first, and test anything else the way he will use it. Run everything on Windows; WSL and Docker Desktop, which runs on it, stay off: a check that needs Linux or containers runs in the project's CI, by pushing the branch. Large installs and data go on D:. Each repository has one clone, on D:; a second checkout is a worktree of it, never a second clone.
- Anything you leave running on his PC past your turn (a server, or a job of an hour or more) shows a notification-area icon with its state and a way to stop it.
