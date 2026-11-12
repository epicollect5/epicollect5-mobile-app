---
description: Cut a mobile-app release — bump version across native + web config, prepend changelog release notes, and attach the signed APK to the GitHub Release
agent: build
---

Run the `release` skill exactly as written. Load it with the `skill` tool using id `release`; its instructions are in `.agents/skills/release/SKILL.md`. The skill works from the repository state, so no arguments are needed — anything the user adds is appended at the end.

$ARGUMENTS
