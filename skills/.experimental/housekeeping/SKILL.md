---
name: housekeeping
description: Runs a full housekeeping pass on a repository after a stretch of work, in a safe order. Use when asked for housekeeping, to clean up or tidy up a project, or to get it ready to hand over.
license: MIT
---

A pass in four steps, safest first. Each step is a focused skill; when that skill is installed, follow it, and when it is not, the line under the step is enough to do it.

## Steps

1. **What could be lost.** Use the `safeguarding` skill. Without it: list data that git does not hold, inside the project and in the home folder, and what can write to it. Make it unreachable before running any test or tool.

2. **Is the code healthy.** Use the `tidying` skill. Without it: run the project's own lint, type and test commands and fix what they mark as safe. Then search for what no command reports: code nothing calls, tests that cannot fail, documents that no longer match the code. Name each in the report, and list old branches and data for the user's yes.

3. **Is each thing still needed.** Use the `cleaning` skill. Without it: for each command, page, setting and stored file, find evidence of use (a log, a link, a recent change), and propose removing what has none. Remove nothing that works without the user's yes.

4. **Do the documents still say what is true.** Use the `doc-upkeep` skill if installed. Without it: replace out-of-date lines in place, never append below them, and give each fact one home: the highest level it applies to (the user's own instructions, then the project's `AGENTS.md`, then its documents). Cut the copies below.

## The report

One line first: is the repository in good shape, and do its checks pass. Then one table per step that found something, in the order above. End with the single decision most needed from the user.

Say which steps ran and which were skipped, and why. A step skipped silently looks like a step that found nothing.
