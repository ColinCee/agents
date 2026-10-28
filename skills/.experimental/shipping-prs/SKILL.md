---
name: shipping-prs
description: Takes a pull request from opened to merged, with tests, an independent review, the automated reviewer's comments on the last push answered and resolved, then the merge. Use when opening, reviewing or merging a pull request.
license: MIT
compatibility: Requires git and the GitHub CLI (gh).
---

A pull request is done when it is merged, not when it is opened. Do every step yourself. Merge only when the user's instructions allow it for this kind of change; otherwise stop after step 5 and ask.

1. **Open it** with a body that says what changed and why in plain words, ending with the attribution line the session gives.
2. **Test it** in proportion to the change: the project's check command, plus a run of what changed.
3. **Get an independent review** from a fresh agent given the diff, not your conclusion. Fix what it finds that is real.
4. **Wait for the automated review of the last push** (Copilot, or whatever the repository runs). Check which commit each review is on: one on an earlier push does not count.
5. **Answer every comment.** Fix it, or reply on the thread with why not; then resolve the thread. A comment about a failure that has not happened and would not be catastrophic gets a reply, not code.
6. **Merge** once the checks pass and nothing is left open, then delete the branch and its worktree, and update any checkout that runs the merged code.

## Gotchas

- Copilot reviews a pull request once, when it opens. After a later push, ask again: `gh pr edit <number> --add-reviewer '@copilot'`. In PowerShell the quotes matter: a bare `@copilot` is read as a variable and the request silently names no one.
- GitHub never resolves a thread when a later commit fixes it; it only marks it outdated. List the open ones with `gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){pullRequest(number:<n>){reviewThreads(first:100){nodes{id isResolved}}}}}'` and resolve each with `isResolved` false: `gh api graphql -f query='mutation{resolveReviewThread(input:{threadId:"<id>"}){thread{isResolved}}}'`.
- A review can arrive after you pushed again, still on the old commit. Compare its commit with the head before treating it as current.
