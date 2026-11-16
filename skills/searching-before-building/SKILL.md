---
name: searching-before-building
description: Finds the maintained tool, library, built-in lint rule or standard that already does a job, before any code is written for it. Use when planning or starting a new check, test, script, parser, component or file format.
license: MIT
---

Agents build their first idea and the user later names the tool that already did it: a regex scan where a linter's built-in rules did the job, a hand-written contrast test where an accessibility checker did. Do this before the plan, not at review, when the code already cost its tokens.

## Steps

1. **Name each job**, one line each, as what it does for the user ("fail CI on a colour typed by hand", "wrap prose at 100 columns"), not as your design ("a regex over source lines"). A job named by its design only finds tools shaped like your design.
2. **Ask a fresh subagent only this question** for every job but a few-line helper: which maintained tool, library, built-in rule of a tool the project already runs, or published standard does each job? Give it the job lines and the project's stack (its package or build files), nothing about your plan. It answers per job with the package, its latest release date and weekly downloads from the registry, or "none found" with what it searched. Asked inside a broader brief, the question gets skipped. Where no subagent can be started, search yourself, job by job.
3. **Check the built-in rules of tools already installed first** (the linter, the test runner, the framework): a rule there adds no dependency.
4. **Say what was found before building**, in the plan or the first message: per job, the tool you will use, or that none fits and why (unmaintained, cannot express the rule, costs more than the job). Then use the tool with its own config, not a wrapper script around it.

## Gotchas

- A review covering every angle of a large diff skipped this question twice; asked alone, it found both tools.
