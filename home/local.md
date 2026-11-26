
# On Colin's own machines

Only on a computer of his, not in the cloud.

## When you need it

| When | Read or do |
|---|---|
| A build, test run, simulation or screenshot job | Run it at full speed, even while a game is open |
| Taking a port or other shared resource | Use the project's fixed port, tell other sessions, and stop servers nobody uses |
| A long or heavy recurring task | Run it overnight |
| A skill, these rules or a hook merged | Run `npm run install-home -- --apply` in the agents repo |

## Facts

- Read the machine's "Agent gotchas" in his notes before you start.
- On the Windows PC, use PowerShell 7, keep WSL and Docker off, put large data on D: and keep one clone per repository.
- Run any command you hand him in his shell and folder first.
- Anything left running past your turn shows a notification-area icon with its state and a way to stop it.
