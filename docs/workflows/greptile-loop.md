# Greptile Loop Workflow

Drive a change to a clean Greptile review: implement, commit, review, fix, and repeat until the review is clean (`commentCount: 0`, confidence 5/5) or every remaining finding is a confirmed false positive.

## Inputs

- `$ARGUMENTS` — the change task, forwarded verbatim from `/greptile-loop`. It may also be a review-only instruction (e.g. "loop over the current branch changes"); when it contains no implementable task, start at step D with the current committed state.
- Repository rules apply verbatim throughout: `AGENTS.md`, `docs/CODE-STYLE.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE-SCHEMA.md`, `src/schemas/*`.

## Greptile CLI protocol

- `greptile review` reviews **committed** changes from the merge base with the remote default branch (`master`) through `HEAD`. Uncommitted and binary changes are excluded — commit before every review. Exit 1 with `there are no committed code changes to review against master` means nothing to review: report that honestly, it is neither a tool failure nor a passing review.
- Always pass `--agent`: plain output, no prompts, no browser sign-in, no update notices.
- Machine-readable state: `greptile review status --json --agent` → `status` (`COMPLETED`, `IN_FLIGHT`, …), `commentCount`, `confidence` (1-5). Exit codes: 0 completed, 1 none/error, 2 invalid input, 3 in progress, 4 failed, 5 cancelled.
- Findings text: the printed output of `greptile review --agent`. Structured findings: `greptile review show --json` (recent list with `runId`), then `greptile review show <runId> --json`.
- The clean state is `status: COMPLETED`, `commentCount: 0`, `confidence: 5` ("0 comments · confidence 5/5").

## Loop

Repeat for at most **8 review cycles**.

### A. Implement

Implement `$ARGUMENTS` (or the fix carried over from the previous cycle). Minimal diffs; components stay UI-only; services own business logic; no TypeScript; `@` imports only; `reactive()` never `ref()`; braces on every `if`/`else`/`for`/`while` body; no inline template logic; no unrelated refactors; no new guards, fallbacks, or catch blocks without a concrete boundary.

### B. Verify

Run the affected tests: `NODE_ENV=test npx vitest run <file-or-pattern>`. All green before any commit. Fix regressions the change introduced before proceeding. In `default` mode, remind the user that `accept-edits` keeps the loop from stalling on every edit.

### C. Commit

Stage only the files touched for this task, never `git add -A` over unrelated work. Conventional Commits: `<type>(<scope>): <description>`, imperative mood, first word not capitalized, no trailing period, ≤75 characters total. Pre-existing uncommitted changes that are not part of the task stay untouched and are reported at the end.

### D. Review

1. `greptile review --agent` — starts the review, waits for completion, prints findings.
2. `greptile review status --json --agent` — authoritative `commentCount` and `confidence` for the stop decision. The `review` command's own exit code is not the signal.
3. Treat any greptile error (auth, network, server, timeout) as a stop: report it. Never interpret an error or an empty output as a passing review.

### E. Triage every finding

Read `docs/known-review-false-positives.md` in full first, then classify each finding in order:

1. **Matches an existing entry** (same defect, same file and condition — or the same defect on a different path) → drop it and note which entry matched.
2. **Real issue** (bug, regression, missing test, genuine edge case at a trust boundary) → minimal fix → back to **B** → **C** → next cycle.
3. **Believed by design, no matching entry** → batch all such candidates into a single `ask_user_question` (multiSelect, one option per finding, proposed `Why it is by design` reason in each option description). Then, per confirmed finding, apply `docs/workflows/false-positive.md` end to end: pointer `/* ... */` comment above the target branch plus an unnumbered bullet in `docs/known-review-false-positives.md` (no `:line`, no numbered markers) → **B** → **C**. Findings the user declines as false positives are real issues: handle them under rule 2.

### F. Stop conditions

Stop (and report) when the first of these holds:

1. `status` is `COMPLETED` with `commentCount: 0` — clean; confidence should be 5. This is the primary success condition.
2. Every remaining finding is dropped by an `docs/known-review-false-positives.md` entry match or confirmed as a false positive by the user.
3. 8 review cycles completed without reaching 1 or 2 — report the remaining findings and counts honestly instead of continuing.

## Hard rules (anti-gaming)

- Never dismiss a finding without either an exact `docs/known-review-false-positives.md` entry match or explicit user confirmation.
- Never silence a finding by weakening or skipping tests, disabling lint, adding suppressions, or swallowing errors.
- Never record an FP entry or pointer comment without user confirmation (`docs/workflows/false-positive.md`: do not assume a finding without confirmation).
- Never treat a greptile error, timeout, or "no committed code changes" as a passing review.
- Never run `git push`, `git reset --hard`, `git clean`, or any history-rewriting or publishing operation as part of this loop.
- Session mode: for a near-unattended run the session must be `accept-edits` (or yolo); in `default` mode every edit and non-allow-listed command prompts.

## Output format (final report)

- **Review trajectory** — per cycle: `commentCount` / `confidence`.
- **Commits** — hash + subject for every commit made.
- **Findings fixed** — numbered per the review's own numbering, one line each: what changed.
- **Findings dropped** — the finding plus the `docs/known-review-false-positives.md` entry that matched.
- **False positives** — candidates proposed, confirmed by the user, and recorded (summary of the bullet added).
- **Files touched** — plus any pre-existing uncommitted files left alone.
- **Outcome** — which stop condition ended the loop; if a cap ended it, the remaining findings.
