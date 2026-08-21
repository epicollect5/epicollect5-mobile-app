---
name: issue
description: Convert the current AI plan into a copy-paste-ready GitHub issue, and save the draft to docs/issues/draft/
---

# GitHub Issue Draft

Convert the current plan from this session into a single, copy-paste-ready GitHub issue.

Follow the **Issue Draft Workflow** defined in `docs/workflows/issue.md`.

If the user passed arguments ($ARGUMENTS), treat them as additional context or constraints.
If $ARGUMENTS contains "title: <text>", use that as the issue title.

The agent must also save the body to `docs/issues/draft/<slug>.md` so the user can later run `/publish-issue` against the canonical drafts location. Do not announce the saved path; it is an implementation detail.
