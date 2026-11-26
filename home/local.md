
# On Colin's own machines

Only on a computer of his, not in the cloud.

## When you need it

| When | Read or do |
|---|---|
| A build, test run, simulation or screenshot job | Run it at full speed, even while a game is open |
| Taking a port or other shared resource | Check what is in use, keep the port in `.claude/launch.json`, tell other sessions, and stop your servers once unused |
| A long or heavy recurring task | Run it overnight; a GPU job still asks first |
| A skill, these rules or a hook merged | Run `npm run install-home -- --apply` in the agents repo |

## Facts

- Read the machine's "Agent gotchas" in his notes before you start.
- On the Windows PC, use PowerShell 7, keep WSL and Docker off (Linux checks run in CI), put large data on D:, and use worktrees, never a second clone.
- Run any command you hand him in his shell and folder first.
- Anything left running past your turn shows a notification-area icon with its state and a way to stop it.
