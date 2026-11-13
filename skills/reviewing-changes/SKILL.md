---
name: reviewing-changes
description: Reviews a change with fresh agents from fixed angles (correctness, running it as users do, design, moved code, one way per job, security, cost, docs, shipping order). Use when reviewing a pull request, a branch or a diff, or before merging one.
license: MIT
---

The author's review finds what the author already thought of. Fresh agents find the rest, but only when given the change and not the author's list of what to check: a reviewer handed that list finds only what is on it.

## Steps

1. **Brief fresh agents** with the diff, the pull request's description (its draft, before opening), the paths of the related repositories, and the skills that fit the change to load first (such as `updating-docs`, `comparing-options`). They read and run read-only checks; they change and post nothing. In a public repository, or someone else's, review before the first push, since the push publishes the change.
2. **One reviewer covers every angle below.** A change that adds a dependency, a secret, a network path or a second repository gets one reviewer per angle instead, at the same time: there one reviewer runs out of attention.
3. **Each finding** gives `file:line`, what breaks and for whom, and how sure; run it when it can be run. A change to a skill or to agent rules cites what it saw (the sessions, the counts), and reviewers check that evidence, since one session rarely shows the pattern.

**Related repositories** are the ones the change reaches: a service it calls or that calls it, infrastructure it runs on, notes or docs kept elsewhere that describe it. The description names them.

## Angles

**Correctness.** Does it do what the description says on every path: failures, empty and odd input, retries, clocks and time zones, concurrency, the first run and the hundredth? Do both sides of every interface (a request and its handler, a writer and its reader, two repositories) agree on names, shapes and limits? Does each `monkeypatch.setattr(module, "name")` or mock target the module that defines the name? One on a module that only imported it changes nothing, and the test passes for the wrong reason.

**Run it as its users start it**, not only by importing it in a test: from the installed layout (for Python, a flat folder of the installed files, with `python -Es`), the script by its own path, the unit or command line that names it. List the run-time paths tests skip and run each: an import inside a function, a file another program runs by name, a string an installer or deploy step checks for.

**Design.** Does the change deepen a module (more behind the same interface) or widen an interface (more names other modules must know)? Count the names that cross module lines before and after. Check a `Design:` section's counts and import order against the code, and that the design it dropped really was worse. An import cycle at load time is a finding.

**Moved code.** Parse each top-level definition the change moves, at the base and at the head (Python: `ast.dump` of each, which leaves out line numbers), and compare. Every difference the description does not list is a finding: a move hides edits from a reader of the diff.

**One way per job.** Search the repository for each helper, setting and pattern the change adds. Doing a job the project already does another way is a finding: name the existing way, and whether to use it or merge both. So is a convention the change adds or relies on that no check holds every instance to.

**Security and exposure.** Read it as an attacker would:

- What becomes reachable that was not, and by whom?
- What does each published value reveal to someone who polls it and keeps the history?
- Where does each secret live, who can read it there, and what can a stolen one do?
- What new code runs with what reach: dependencies pinned by hash or not, network and file access beyond what the job needs?
- Can a placeholder, a default or an empty value be abused before the real one is set?
- In a public repository, do the diff or the description name anything private: hosts, addresses, paths, accounts, work projects or people?

**Performance and cost.** Page weight, request count, startup and response time, and any quota or free-tier limit the change adds calls against. What happens when someone sends many requests on purpose?

**Docs, here and in the related repositories.** Search each for text describing what changed: READMEs, runbooks, design docs, notes, code comments, the description itself. Each claim the change makes false is a finding: quote the line and the file. Check each claim against the code, not the doc's own wording (`updating-docs`, when installed). Then size: `git diff --stat <base> -- <paths>` over the docs, rules and skills the diff touches. Net lines added are a finding unless the description says in one line why nothing could be reworded, merged or moved out; a new need is a reason, a fix that only adds a line is not.

**Shipping order.** When the change spans repositories or needs a secret, a migration or a setting: does any order of merging and deploying break something in between? Is each step that needs the user named, before the merge that depends on it?
