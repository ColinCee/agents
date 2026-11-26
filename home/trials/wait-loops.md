---
status: testing
measures: wait-loops
started: 2026-11-27
---
## Off
A run, wait loop or background command that may take long gets a limit inside the command just above its expected time (a background command gets no tool timeout), so a hang shows early.
## On
Give a long run, wait loop or background command a time limit inside the command, just above its expected time.
