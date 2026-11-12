---
description: Drive a change to a clean greptile review — implement, commit, run "greptile review", fix findings, repeat until 0 comments / confidence 5/5 or only confirmed false positives remain
---

Run the `greptile-loop` skill exactly as written. Load it with the `skill` tool using id `greptile-loop`; its instructions are in `.agents/skills/greptile-loop/SKILL.md`. The skill works from the repository state, so no arguments are needed — anything the user adds is appended at the end.

$ARGUMENTS
