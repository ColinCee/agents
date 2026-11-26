---
name: placing-code
description: Decides where code goes, with folders by job, files and tests beside what uses them, no catch-all folders, splits with the fewest names crossing modules, safe moves. Use when adding or splitting a module, or restructuring a repo.
license: MIT
---

Agents fix the file in front of them, so a repository's layout drifts: a `scripts/` folder fills with anything, tests pile up in a `tests/` tree, a helper used once lives far from its user. This skill looks at the whole repository first and plans where everything belongs; moving files follows `references/moving.md`, and splitting one `references/splitting.md`.

## Steps

1. **Map every tracked file** (`git ls-files`): its job in a few words, and what uses it: imports, and paths named in workflows, service units, compose files, build files and scripts. Note how the project is started and installed (commands, entry points, paths copied to a host, CI jobs): those paths are contracts.
2. **Draw the top level**: one folder per job a reader would look for (`billing/`, `deploy/`, `docs/`), each with its job in one line, about seven at most. Never a catch-all (`scripts/`, `utils/`, `lib/`, `common/`, `helpers/`, `misc/`, `shared/`) or a folder per layer or file type (`services/`, `models/`, `configs/`): they grow by whatever is easiest to add. At the root only what tools need there.
3. **Place each file:**
   - A file only one other uses sits beside that user.
   - A test sits beside the code it tests (`billing/invoice.py`, `billing/invoice_test.py`), not in a separate `tests/` tree; shared fixtures sit with the tests that use them.
   - A unit, config or Dockerfile sits beside the program it runs or configures.
   - What several jobs use lives once, where all of them import it, never a copy per job.
   - A subfolder earns its place when its files use each other more than the rest. Prefer fewer, flatter folders; three levels at most.
4. **Find duplicates and dead files**: two files or functions doing one job, two copies of one list, constant or config, and files nothing uses or runs. Plan one home for each and plan deleting the dead.
5. **Check the plan**: count the uses that cross a top-level folder before and after; the new layout crosses fewer, and no two folders import each other. A big file doing several jobs is split in its own change (`references/splitting.md`), not in this pass.
6. **Write it down**: a table of folders and their jobs, then every move as old path → new path. The layout ships with a test that keeps it: it fails on a top-level folder missing from the table, a catch-all name, a single-use file away from its user, or a test away from its code. Without one, the next agent undoes the layout.

## Gotchas

- Splitting a flat package into feature folders adds crossings when every feature imports a shared core: keep the core at the package's top, so features only import upward.
- A folder named for a tool's convention or a technology (`conf.d/`, `yaml/`) hides its job; name it for the job.
- Paths a host installs, a unit runs or CI names are contracts: each move updates every reference in the same change.
