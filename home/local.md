
# On Colin's own machines

Only on a computer of his, not in the cloud.

## When you need it

| When | Read or do |
|---|---|
| Builds, tests and screenshots | Run at full speed, even during a game |
| Ports and shared resources | Check use, tell other sessions, keep the `.claude/launch.json` port, stop your idle servers |
| Long recurring jobs | Run overnight; a GPU job still asks first |
| Rules, skills or hooks merged | Run `npm run install-home -- --apply` in the agents repo |

## Facts

- Read the machine's "Agent gotchas" in his notes first.
- On Windows: PowerShell 7, WSL and Docker off, big data on D:, worktrees not second clones.
- Run any command you hand him in his shell first.
- Anything left running past your turn shows a tray icon with a stop.
