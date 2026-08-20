---
description: Generate a Conventional Commits message from staged changes
agent: build
---

Write a single Git commit message in English following the Conventional Commits specification.

First, run `git diff --cached` to get the staged changes. If nothing is staged, run `git diff` instead and note that nothing was staged.

Requirements:

Format: <type>: <description>
Allowed types: feat, fix, refactor, perf, docs, test, build, ci, chore, style, revert
Use the imperative mood (e.g. "add", "fix", "remove")
Do not capitalize the first word of the description.
Do not end the description with a period.
Maximum 75 characters total, including type and scope.
Return only the commit message, with no explanation or code fences.
If the change includes both a fix and a feature, prefer the type that best reflects the primary purpose.
