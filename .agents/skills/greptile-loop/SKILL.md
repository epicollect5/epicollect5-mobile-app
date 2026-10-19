---
name: greptile-loop
description: Drive a change to a clean greptile review — implement, commit, run "greptile review", fix findings, repeat until 0 comments / confidence 5/5 or only confirmed false positives remain
---

# Greptile Loop

Run the greptile review loop.

Follow the **Greptile Loop Workflow** defined in `docs/workflows/greptile-loop.md`.

Forward `$ARGUMENTS` verbatim to the workflow. If `$ARGUMENTS` is empty, ask for the change task (or confirm review-only mode over the current branch) before starting.
