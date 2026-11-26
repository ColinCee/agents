---
status: testing
measures: pr-skill, merge-review
started: 2026-11-27
---
## Off
Every change ships in a pull request from its own branch, merged once its checks pass and its `shipping-prs` review is done; a second agent in the same repo gets a worktree. Related small changes from one session to one repo share one pull request, so checks and review run once, unless only some wait for his OK or a skill asks for its own.
## On
Ship every change in a pull request from its own branch, merged after its checks pass and its `shipping-prs` review.
Related small changes to one repository share one pull request, unless only some wait for his OK.
A second agent in the same repository works in its own worktree.
