---
description: Mark review finding as false positive — comment code and record in known-review-false-positives.md
---

Run the `false-positive` skill exactly as written. Load it with the `skill` tool using id `false-positive`; its instructions are in `.agents/skills/false-positive/SKILL.md`. The skill works from the repository state, so no arguments are needed — anything the user adds is appended at the end.

$ARGUMENTS
