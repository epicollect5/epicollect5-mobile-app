---
description: Pick a pending issue from docs/issues/draft/, show it for review, then publish to GitHub on confirmation
---

# GitHub Issue Publisher

Publish a previously-drafted issue body to a GitHub repository using the `gh` CLI.

Follow the **Issue Publish Workflow** defined in `docs/workflows/publish-issue.md`.

## Default target

`epicollect5/epicollect5-development-plan` — the issues tracker is always this repo. Pass `repo:<owner/name>` to override.

## Drafts location

`docs/issues/draft/` — `/publish-issue` lists every `*.md` file in this directory and asks the user to pick one. After a successful publish, the file is removed.

## Safety

This command is side-effecting (creates a public GitHub issue). The workflow always shows the user the resolved title, repo, labels, and draft status, and asks for explicit confirmation before running `gh issue create`. Confirmation may be skipped only when the user explicitly supplies the `yes` argument.

## Inputs

The user can pass arguments to override the interactive picker:

- `/publish-issue` (no args) — list pending drafts and ask which to publish.
- `/publish-issue <file>` — skip the picker, use the file directly (path relative to repo root, inside `docs/issues/draft/` or absolute).
- `/publish-issue <file> repo:<owner/name>` — publish to a specific repo instead of the default.
- `/publish-issue <file> title:<text>` — override the title (otherwise extracted from the first H1).
- `/publish-issue <file> labels:<csv>` — apply labels (comma-separated).
- `/publish-issue <file> draft` — create the issue as a draft instead of publishing it.
- `/publish-issue <file> yes` — skip the confirmation prompt. Use only when the user explicitly opts out.

Multiple overrides can be combined.
