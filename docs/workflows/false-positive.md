# False Positive Workflow

Mark a review finding as a false positive by commenting the related code and recording the reason in `docs/known-review-false-positives.md`.

This workflow implements **Approach C (Pointer)**: the code comment is a short pointer to `docs/known-review-false-positives.md`; the markdown file is the single canonical source for the full `Reported as` / `Why it is by design` / optional `docs/ARCHITECTURE.md` reference. No line numbers are stored anywhere.

## Inputs

- `$ARGUMENTS` (optional): may contain `file` (`src/...` without `:line`), `condition/branch` summary, `Reported as` text, `reason`, or `ARCHITECTURE.md` section. Arguments are forwarded verbatim from the command wrapper — if empty, derive everything from session context.
- **Session context** (primary when `$ARGUMENTS` is empty): the most recent review report in the current conversation (per `docs/workflows/review.md` Per-Issue Format: `Severity`, `File: path:line`, `Explanation`, `Suggested fix`).

## Responsibilities

- Derive the target from session context when invoked as `/false-positive` with no arguments.
- Annotate the related code with a concise `/* ... */` block pointer (no duplicated rationale, no line number).
- Append or update an unnumbered bullet in `docs/known-review-false-positives.md` (no line numbers, no numbered list).
- Ask before overwriting a duplicate.
- Preserve existing architecture: components remain UI-only, services own logic.

## Step 1 — Resolve the target

1. If `$ARGUMENTS` contains a `file` path, use it; strip any trailing `:line` or `:line:col` — line numbers are never stored.
2. If `$ARGUMENTS` is empty or lacks `file`:
   a. Scan the session history for the most recent review report.
   b. If exactly 1 finding exists, assume that finding after confirming with the user: "Mark finding `File: <file>` — `<Explanation snippet>` as false positive? (y/n)".
   c. If >1 finding exists, list each as `- File: <file without :line> — <Explanation first sentence>` and ask: "Which finding is a false positive? Reply with the number or file."
   d. Derive `file` from the chosen finding's `File` field (strip `:line`). Derive `Reported as` from its `Explanation`. Derive `condition/branch` from the finding's file context (e.g. `error?.versionChanged` branch, function or symbol name near the flagged line) — read the file to identify the nearest enclosing branch/symbol; never store a raw line number.
3. Resolve `reason` (`Why it is by design`):
   a. If `$ARGUMENTS` or session already contains a reason ("by design because...", "this is intentional..."), use it.
   b. Otherwise ask: "Why is this a false positive? Provide 1-3 sentences. This text will be stored in `docs/known-review-false-positives.md` and is the canonical rationale."
   c. `reason` is required — do not proceed without it.
4. Resolve optional `ARCHITECTURE.md` section: include only if the invariant is documented there (e.g. `Native Download` section). If the user mentions an architecture section, use it; otherwise omit — do not force an arch link.

Fail fast if `file` or `reason` cannot be resolved after asking.

## Step 2 — Read context

1. `Read` the target file (use full file context or ±30 lines around the identified `condition/branch` — search for the symbol/branch name, not a line number).
2. `Read` `docs/known-review-false-positives.md` (whole file — required by `docs/workflows/review.md:11`).
3. `Read` `docs/ARCHITECTURE.md` only if an arch section reference will be stored.

Check for duplicates before writing:
- A duplicate is an existing bullet with the same `file` and same or very similar `condition/branch` (fuzzy match on file + condition).
- If a duplicate is found, **ask each time** (do not auto-update or auto-append):
  > "An entry for `<file>` (`<condition>`) already exists in `docs/known-review-false-positives.md`. What should I do? [Update existing / Append variant / Cancel]"
  Act according to the user's choice. If `Update existing`, replace the existing bullet's `Reported as` / `Why` in place. If `Append variant`, add a new bullet. If `Cancel`, stop.

## Step 3 — Comment the related code

Insert a `/* ... */` block comment **immediately above** the relevant `if` / branch / function / statement identified by `condition/branch`. Do not insert inline trailing comments. Do not change logic.

Use `/* ... */` for `.js`, `.ts`, and `.vue` `<script>` blocks. For `.vue` `<template>` findings, use `<!-- ... -->` with the same text (but prefer commenting the script side when possible).

Template (Approach C Pointer — no rationale duplication, no line number):

```js
/*
 * False positive (review): <short summary> — by design. See docs/known-review-false-positives.md
 * (`<file>`, `<condition/branch>`).
 */
```

Rules:
- `<short summary>` is a concise phrase (e.g. "mid-download abort intentionally keeps rows").
- `<file>` is without `:line` (e.g. `src/services/entries-download-service.js`).
- `<condition/branch>` is the symbol or branch (e.g. `error?.versionChanged` branch).
- Do not duplicate the full `Reported as` / `Why` in the comment — the markdown file is the canonical source.
- Do not include a line number in the comment.
- Keep the comment to 1-2 lines plus the `/*` / `*/` delimiters.
- Follow `docs/CODE-STYLE.md` — no unrelated refactoring, no `ref()` introduction, no TypeScript, no style changes beyond the comment.

Example (real entry):

```js
/*
 * False positive (review): mid-download abort intentionally keeps rows — by design. See docs/known-review-false-positives.md
 * (`src/services/entries-download-service.js`, error?.versionChanged branch).
 */
if (error?.versionChanged) {
```

## Step 4 — Append or update `docs/known-review-false-positives.md`

Format is **unnumbered bullets, no line numbers**. Each entry:

```md
- **<Summary>** (`<file>`, `<condition/branch>`)
  Reported as: "<finding Explanation verbatim>"
  Why it is by design: <reason>. See <Section> of `docs/ARCHITECTURE.md` for the full invariant.
```

Rules:
- Use `- **...**` (bullet), never `1. **...**`. If the file still contains numbered entries (`1. **...**`), migrate them to bullets and strip any `:line` in the same edit.
- `<Summary>` is the finding title (e.g. "Partially downloaded entries are not wiped when a download aborts on a mid-download project version change").
- `<file>` is without `:line`. `<condition/branch>` is the same string used in the code comment.
- `Reported as:` is the original review `Explanation` (or `$ARGUMENTS` provided text), quoted.
- `Why it is by design:` is the resolved `reason` plus an optional `See <Section> of docs/ARCHITECTURE.md` suffix when applicable. If no arch section, end after the reason with a period.
- Keep the file header (`# Known Review False Positives` + description paragraph) intact.
- Append the new bullet at the end of the list, preserving a blank line between entries.
- Never store `:line` or `:line:col` in this file.

On `Update existing`, replace the matched bullet's `Reported as` and `Why` lines in place, preserving its position.

## Step 5 — Verify

- `git diff --stat` shows the source file + `docs/known-review-false-positives.md` (and potentially the workflow migration of the old numbered entry, which counts as part of the md change).
- The `/* ... */` block is balanced (no unclosed comment) and placed directly above the target branch.
- No `:line` appears in the new or updated md bullet, and no numbered list marker (`1. `) remains.
- Lint passes (`eslint` if applicable) — a block comment must not break the build.

## Step 6 — Report

Output:
- `Commented <file> (<condition/branch>) with pointer to docs/known-review-false-positives.md`
- `Recorded in docs/known-review-false-positives.md as bullet: "<Summary>"` (or "Updated existing entry for ...")
- Note: future reviews per `docs/workflows/review.md:11` will read this file and drop matching candidates.

## Example invocation

- Zero-arg (session context): `/false-positive` → agent derives finding from last review, asks for reason if missing, then comments and appends.
- With args: `/false-positive src/services/web-service.js error?.versionChanged --reason "rows match still-old structure until updateProject()" --reported "abort leaves corrupt rows"` (line numbers are ignored if provided).
