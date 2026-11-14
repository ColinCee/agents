# Moving code without breaking callers

Agents add to the file that already holds related code, so files only grow. Restructuring is moving code to where its job lives, not rewriting what it does. Moving one or two files needs only steps 1, 2, 4 and 5; the guard test and the cycle check pay off when a folder of modules moves.

## Steps

1. **Plan the layout first**, as the `placing-code` SKILL.md says.
2. **Leave in place what finds itself by location**: code that counts folders up to find the repository root, reads a file beside it, or is copied out alone by a build. Search for `__file__`, `parent.parent`, `import.meta.url` and the like before moving a file.
3. **Add a guard test first**, in its own change: it fails when any workflow, doc, skill or test names a path or module that no longer exists. Also find tests and checks that only look in the top folder (`glob("*.py")`, a flat directory list); make them search every folder, or they keep passing while silently checking nothing.
4. **Move in order**: first the modules nothing else in the code imports, so no other file changes; modules that import each other in a loop move together in one change, since splitting them gains nothing.
5. **Keep names and callers working.** File names stay the same, so searches and history still find them. Every name other code imports stays importable from where it was (a re-export is fine) until its callers move. Update imports, command entry points, workflow lines, docs and skill links in the same change.
6. **Then deepen, separately.** Splitting a big module into a few deep ones (much behind a small interface) is its own change after the moves, designed first as `references/splitting.md` says.

## Every change

- The project's whole check passes, and anything it runs (an app, a command line, a server) is started once the way its users start it: a move breaks imports that only load at run time.
- No import cycle at load time. If the project has no check for it, add one: a load-time cycle works or breaks depending on which module loads first.
- Merge while nothing else is changing those files; a move conflicts with every open branch that touches them.

## Gotchas

- An agent told to "refactor toward better abstractions" moved test helpers that other tests import, and introduced a load-time import cycle; both passed its own test run and broke the next change.
- A planned folder of three files was dropped: they imported back and forth with a bigger folder's files, so the split added a cycle and helped no reader. A folder earns its place when its files import each other more than they import the rest.
- A size or line-count record keyed by path goes stale on every move; update its keys in the same change.
