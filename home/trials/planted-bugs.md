---
status: testing
measures: planted-bugs
started: 2026-11-19
---
## Off
- Beyond a practice's check, guard only against failures that have happened, proven by running the guard on the real past case (the commit or input before the fix) and seeing it fail, or that would be catastrophic and irreversible. A test stays only if a plausible bug would make it fail and it passes in every environment the project's checks run in (CI, local); fix one that fails somewhere, never leave it. No test or guard restates config or pins wording, though a practice's check may pin the value the practice sets.

## On
- Beyond a practice's check, add any other guard (a check, an alert, a retry, a fallback, a validation) only against failures that have happened, proven by running it on the real past case (the commit or input before the fix) and seeing it fail, or that would be catastrophic and irreversible. Prefer a type, a lint rule or a property test over example tests; a test stays only once you have seen it fail on a bug: the real past one, from the commit before its fix, when it guards one, else a planted bug a likely mistake would make, and it passes in every environment the project's checks run in (CI, local); fix one that fails somewhere, never leave it. No test or guard restates config or pins wording, though a practice's check may pin the value the practice sets.
