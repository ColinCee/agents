---
status: settled
measures: planted-bugs
started: 2026-11-16
---
## Off
Beyond a practice's check, guard only against failures that have happened, proven by running the guard on the real past case (the commit or input before the fix) and seeing it fail, or that would be catastrophic and irreversible. A test stays only if a plausible bug would make it fail and it passes in every environment the project's checks run in (CI, local); fix one that fails somewhere, never leave it. No test or guard restates config or pins wording, though a practice's check may pin the value the practice sets.
## On
Guard only against failures that happened, proven on the real case, or catastrophic ones; keep tests a bug would fail.
