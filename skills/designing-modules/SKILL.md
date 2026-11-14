---
name: designing-modules
description: Designs a split or a new module two ways, counts the names that would cross module lines, and keeps the smaller interface with no load-time import cycle. Use when about to add a module, add a function other modules call, or split a file.
license: MIT
---

The first split that comes to mind follows the file's headings, not who calls what, and its cost shows later as names every module has to know. Count before moving code.

## Steps

1. **Map who calls what** with the language's own parser (Python's `ast`, the TypeScript compiler API), not by reading: for each top-level name, the names it uses and what uses it, tests included. Names that use each other more than they use the rest belong together.
2. **Design it two ways** that put the seams in different places, not two namings of one split: for example each module owning its own types against one shared module of types, or the poll loop keeping its state against a module for state. Write each as a list of modules and what each holds.
3. **Count the names that cross module lines** in each design, by script over the code or a draft of it: every `module.name` reference and every `from module import name` between the modules, each defining-module-and-name pair once, however many modules use it. Names a test reaches count too: they are interface.
4. **Keep the design with fewer crossings, and drop any whose imports form a cycle at load time** (imports at module level or in a class body; one under `if TYPE_CHECKING:` or inside a function does not run at load). A cycle works or breaks depending on which module loads first. On a tie, keep the design whose modules a reader would look for by job.
5. **Write a `Design:` section** in the pull request: each design in a line, its crossing count, the load-time import order of the kept one, and why the other lost. Reviewers check it against the code.

## Gotchas

- One shared module of types looked simplest. It had more crossings (67 against 59) and cycles at load time, because the shared types needed types from the modules that imported them.
- A line cap moves code to random seams; the crossing count measures what callers must know.
- After a split, reach a sibling by `module.name`: `from x import name` copies the name, so a test's patch on `x` misses the copy.
