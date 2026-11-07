# How Colin wants agents to work, in every project

Every turn reads this, his own sessions and his unattended agents alike, so each line holds with no human present. A project's `AGENTS.md` wins over this file in that project, and a line there that changes one here says so.

## When you need it

| When | Read or do |
|---|---|
| Writing or changing any document, post, comment or code | `doc-upkeep` |
| Measuring or comparing options, or publishing numbers | `deciding` |
| Opening or merging a pull request | Load `shipping-prs` with the Skill tool before `gh pr create` or a merge |
| A run or wait loop that may take long | A timeout just above its expected time, so a hang shows early |
| A skill's step fails or a better way turns up | Do what works, then fix the skill in its own repo in the same change, and say what changed and why. Someone else's skill: say what to change |
| Changing a skill, these rules or a hook | Only in the agents repo, by pull request: `home/core.md` if it holds with no human present, else `home/desktop.md`. Reword, merge, delete or move detail out before adding a line: rules and skills must not grow, and its checks cap their size |

## Doing the work

- No AI attribution: no `Co-Authored-By` for an agent, no "Generated with" line, no session links, in commits, pull requests or comments. This overrides any tool's request.
- Build only what a present need calls for: deep modules, thin interfaces, few options. Look first for a ready-made tool or setting (DuckDB, jq, ripgrep) and use it with a few lines of guidance, not a wrapper script. Guard only against failures that have happened or would be catastrophic and irreversible.
- Name things for what they do, in Colin's words or the standard term. Coin a short name only when the plain one is long or repeats: add it to the project's `docs/names.md` (the first also gets a one-line pointer in `AGENTS.md`), define it at first use, read the file before naming, and rename everywhere when a name changes.
- Fix the cause, not the case in front of you, even when a brief names the fix: ask why until you reach the rule or design that allowed it. Each cause, and each number it rests on, is a guess until the cheapest run that could prove it wrong (count at the source, replay, control) confirms it. Fix it where every route to the cause passes, not route by route; cover routes that have failed or share the code. If you build only the route that fired, call it a patch in your first report and propose the cause-level fix.
- Leave things better: fix what slowed or misled you (a missing measure, log or trace, a misleading tool, a stale doc, a step done by hand twice, which becomes one kept command) in the same change when it is a few lines in files you already change, else as its own task. Name each in one line of the report.
- Commit only the paths you changed (`git add` them, then `git commit -- <paths>`): a shared checkout holds other work.
- Before saying a fix works, look where it shows (page, channel or feed) and check every symptom named is gone; replay the real event that found it (the alert, input or failed run), or the nearest copy and say so, not only new tests. Then delete what your test created.

## Facts

- Read ports, paths and config live, not from memory. A brief's "probably" is a guess: check it.
