---
description: Create Conventional Commits from changes, splitting by type and scope
agent: build
---

Analyze all changes and create one or more Conventional Commits, grouped by type and scope. Execute the commits yourself; never leave the work as a proposal.

Steps:

1. Inspect: run `git status --short`, `git diff --cached --name-only`, and `git diff --name-only`. If nothing is staged, stage all tracked modifications with `git add -u` (untracked files stay untouched and are reported at the end).
2. Classify: read the diff of every changed file (`git diff --cached` or `git diff`) to determine its type (feat, fix, refactor, perf, docs, test, build, ci, chore, style, revert) and scope. Map directories to scopes: `src/services/**` -> services, `src/components/**` -> components, `src/stores/**` -> stores, `src/models/**` -> models, `src/pages/**` -> pages, `src/router/**` -> router, `src/config/**` -> config, `docs/**` -> docs. Test files take the scope of the code under test. Root, leaflet, theme and use files get no scope.
3. Decide the structure: a single commit is fine when all changes share one type and one scope, or when the change is small and cohesive (one logical change). Otherwise split by type + scope: one commit per group, never mixing types or unrelated areas in a commit. Commit order should read logically: code before its tests, docs and chore last.
4. Execute: for each group, commit only the files belonging to it with `git commit <paths> -m "<message>"`. Verify each commit succeeded before moving on; if one fails, stop and report. Leave unstaged and untracked files untouched, except for the `git add -u` in step 1.
5. Report: list the commits created with `git log --oneline -N`, and mention any untracked files that were skipped.

Message requirements:

Format: <type>(<scope>): <description> — scope is optional for docs, test and chore commits.
Allowed types: feat, fix, refactor, perf, docs, test, build, ci, chore, style, revert
Use the imperative mood (e.g. "add", "fix", "remove")
Do not capitalize the first word of the description.
Do not end the description with a period.
Maximum 75 characters total, including type and scope.
If a group includes both a fix and a feature, prefer the type that best reflects the primary purpose of that group.