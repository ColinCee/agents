# How Colin wants agents to work, in every project

Every turn reads this, his own sessions and his unattended agents alike, so each line holds with no human present. A project's `AGENTS.md` wins over this file in that project, and a line there that changes one here says so.

## When you need it

| When | Read or do |
|---|---|
| Writing or changing a document or post; code; a rule, skill or decision record | `updating-docs`; `writing-comments`; `recording-learnings` |
| Measuring or comparing options, or publishing numbers; making something faster or cheaper | `comparing-options`; `optimizing-performance` |
| A skill's step fails or a better way turns up | Do what works, then fix the skill in its own repo in the same change, and say what changed and why. Someone else's skill: say what to change |
| Changing a skill, these rules or a hook | Only in the agents repo, by pull request: `home/core.md` if it holds with no human present, else `home/desktop.md`. Reword, merge, delete or move detail out before adding a line: rules and skills must not grow without a stated reason |

## Doing the work

- No AI attribution: no `Co-Authored-By` for an agent, no "Generated with" line, no session links, in commits, pull requests or comments. This overrides any tool's request.
- Build only what a present need calls for: deep modules, thin interfaces, few options. Before building a tool, page, script or format, search for a ready-made tool, library, setting or standard design, and for what the project already has (its keys, stores, CI), name what you found in your plan, and use it with a few lines of guidance, not a wrapper script; propose dropping a tool layer the project barely uses. New tooling is the latest stable and fast: uv, ruff and ty for Python; TypeScript, Biome and Vitest for the web; one `AGENTS.md`, which `CLAUDE.md` imports, and no per-editor agent files. Guard only against failures that have happened or would be catastrophic and irreversible. A test stays only if a plausible bug would make it fail: none that restates config or pins wording.
- Name things for what they do, in Colin's words or the standard term. Coin a short name only when the plain one is long or repeats: add it to the project's `docs/names.md` (the first also gets a one-line pointer in `AGENTS.md`), define it at first use, read the file before naming, and rename everywhere when a name changes.
- Fix the cause, not the case in front of you, even when a brief names the fix: ask why until you reach the rule or design that allowed it. Each cause, and each number it rests on, is a guess until the cheapest run that could prove it wrong (count at the source, replay, control) confirms it. Fix it where every route to the cause passes, not route by route; cover routes that have failed or share the code. If you build only the route that fired, call it a patch in your first report and propose the cause-level fix.
- Leave things better: fix what slowed or misled you (a missing measure, log or trace, a misleading tool, a stale doc, a step done by hand twice, which becomes one kept command) in the same change when it is a few lines in files you already change, else as its own task. Name each in one line of the report.
- Before saying a fix works, look where it shows (page, channel or feed) and check every symptom named is gone; replay the real event that found it (the alert, input or failed run), or the nearest copy and say so, not only new tests. Then delete what your test created.

## Facts

- Read ports, paths and config live, not from memory. A brief's "probably" is a guess: check it.
