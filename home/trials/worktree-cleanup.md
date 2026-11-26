---
status: settled
measures: worktrees-left
started: 2026-11-16
---
## Off
Once the pull request of a worktree you made is merged or closed, leave its folder and remove it (`git worktree remove`, never `--force`; or ExitWorktree with remove); give a detached one a branch first, so its commits stay.
## On
Remove your worktree once its pull request merges or closes, with `git worktree remove`, never `--force`.
