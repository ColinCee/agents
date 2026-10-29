---
name: shipping-prs
description: Takes a pull request from opened to merged, with tests, an independent review, the automated reviewer's comments on the last push answered and resolved, then the merge. Use when opening or merging a pull request.
license: MIT
compatibility: Requires git and the GitHub CLI (gh).
---

A pull request is done when it is merged, not when it is opened. Asked only to review a pull request: report what you find and stop. Otherwise do every step yourself. Merge yourself unless the user's instructions say this kind of change waits for them; then stop after step 4 and ask.

1. **Open it** with a title naming what users get, not the mechanism, and a short body under headings holding only what the diff cannot show, inside the repository's template if it has one: the problem in a sentence or two, why it happens when that is not obvious, related issues, PRs and commits as bullet lists, testing beyond the test files (fails before and passes after, manual runs, platforms), before and after screenshots for a visible change, and anything left out of scope. No list of changes unless a large diff needs a map. Add an attribution line only if the user's own instructions ask for one.
2. **Test it** in proportion to the change: the project's check command, plus a run of what changed.
3. **Get both reviews in one round.** Start a fresh agent on the diff (not your conclusion) while the repository's automated reviewer reviews the opened PR; in someone else's repository, run the agent before step 1, since opening publishes it. Wait up to about 10 minutes for the automated one; past that, go on without it.
4. **Sort every comment once.** A real bug: fix it. A nit, or a failure that has not happened and would not be catastrophic: a one-line reply. Then resolve every thread, and push all the fixes together after re-running the checks. Ask for a second automated review only when that push changed what the code does; wording fixes don't need one. Its comments are sorted the same way, once; no third round.
5. **Merge** once the checks pass and nothing is left open, then delete the branch and its worktree, and update any checkout that runs the merged code.

## Gotchas

- Copilot reviews only when requested: on open if the repository is set up for it, else, and for any later push, `gh pr edit <number> --add-reviewer '@copilot'` (in PowerShell a bare `@copilot` is read as a variable). The request may not show in `reviewRequests`, so before merging wait for the review itself in `gh pr view <number> --json reviews`; it takes about five minutes.
- GitHub never resolves a thread when a later commit fixes it; it only marks it outdated. List the open ones with `gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){pullRequest(number:<n>){reviewThreads(first:100){nodes{id isResolved}}}}}'` and resolve each with `isResolved` false: `gh api graphql -f query='mutation{resolveReviewThread(input:{threadId:"<id>"}){thread{isResolved}}}'`.
