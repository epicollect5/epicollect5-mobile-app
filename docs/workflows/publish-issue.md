# Issue Publish Workflow

Pick a reviewed issue body (a Markdown file in `docs/issues/draft/`) and publish it to GitHub via the `gh` CLI. Designed as the second half of a two-step workflow: `/issue` drafts (and saves to `docs/issues/draft/`), `/publish-issue` publishes after human review.

This workflow is side-effecting (creates a public GitHub issue). It always shows the user the publish details and asks for explicit confirmation before running `gh issue create`. The confirmation is the safety gate, not the user's review of the file (which happens in step 1 via the file in `docs/issues/draft/`).

## Inputs

`$ARGUMENTS` (optional): space-separated key:value overrides and an optional file path.

Recognised keys:

- `<file>` — optional. Path to a specific Markdown file in `docs/issues/draft/`. If omitted, the workflow lists every `*.md` file in `docs/issues/draft/` and asks the user to pick.
- `repo:<owner/name>` — optional. Target repo. Defaults to `epicollect5/epicollect5-development-plan`.
- `title:<text>` — optional. Override title. Defaults to the first H1 in the file.
- `labels:<csv>` — optional. Comma-separated label names to apply.
- `yes` — optional flag. If present, skip the confirmation prompt. Only use when the user explicitly opts out.

## Source of truth

- The file inside `docs/issues/draft/` is the only source of truth for the body.
- Do NOT modify the body. The user has already reviewed it.
- Do NOT re-derive the body from session context, plans, or earlier messages.
- Do NOT scan the repository beyond reading the drafts directory.

## Preconditions

Verify before showing the confirmation prompt:

1. The `gh` CLI is installed. First check `command -v gh`. If that fails, scan the common install locations and add the first one found to `PATH` for this session:

   ```bash
   if ! command -v gh >/dev/null 2>&1; then
       for gh_path in /opt/homebrew/bin/gh /usr/local/bin/gh /usr/bin/gh; do
           if [ -x "$gh_path" ]; then
               export PATH="$(dirname "$gh_path"):$PATH"
               break
           fi
       done
   fi
   command -v gh >/dev/null 2>&1 || { echo "gh CLI not found. Install with: brew install gh"; exit 1; }
   ```

   This handles the case where opencode was launched from a context that does not include Homebrew's bin directory (e.g. launched from Finder rather than Terminal).
2. `gh` is authenticated (`gh auth status`). If not, stop and tell the user to run `gh auth login`.
3. `docs/issues/draft/` exists and contains at least one `*.md` file. If empty, stop and tell the user to run `/issue` first to create a draft.

If any precondition fails, do not proceed to the confirmation step. Surface the failure and stop.

## Responsibilities

1. Parse `$ARGUMENTS` into the recognised keys above.
2. Resolve the file:
   - If `<file>` is given: use an absolute path as-is; use a path starting with `docs/issues/draft/` as-is (repo-root-relative); resolve any other relative path against `docs/issues/draft/`.
   - Otherwise, list every `*.md` file in `docs/issues/draft/`. For each, read the first H1 line and present a numbered picker to the user. If there is exactly one draft, skip the picker and proceed with it. If there are zero drafts, stop with a clear message.
3. Resolve the target repo:
   - If `repo:` is set, use it verbatim.
   - Otherwise, default to `epicollect5/epicollect5-development-plan`.
4. Resolve the title:
   - If `title:` is set, use it verbatim.
   - Otherwise, read the first non-empty line of the file; if it starts with `# `, use the rest of the line (stripped) as the title.
5. Show the body for review. If the file is under 200 lines, show it in full. If longer, show the first 50 lines, a `…` marker, and the last 20 lines.
6. If `yes` is NOT in `$ARGUMENTS`, show the confirmation prompt (see below) and wait for the user's explicit go-ahead. If the user declines or times out, stop without running `gh` and without deleting the file.
7. Run exactly one of the following:

   ```bash
   gh issue create --repo "$REPO" --title "$TITLE" --body-file "$FILE" [(--label "$LABEL")...]
   ```

8. On success, delete the source file (`rm <file>`). On failure, do NOT delete — leave the file in place so the user can retry.
9. Capture stdout. `gh issue create` prints the issue URL on success.

## Interactive flow

When `<file>` is omitted, present the picker as a numbered list of H1s (one per draft). Ask the user to type a number, or to type `cancel` to abort. Do not present this as a `question` tool prompt — a free-text reply is more natural for a numbered selection.

When `<file>` is provided, skip the picker and go straight to the body review.

## Confirmation prompt

After showing the body for review, use the `question` tool (or an equivalent prompt) with these details:

- **Question**: `Publish this issue to <repo>?`
- **Header**: `Confirm publish`
- **Options** (one per line in the prompt body):
  - Title: `<title>`
  - Labels: `<labels or "none">`

Choices:

- `Yes, publish` — runs `gh issue create` and deletes the draft on success
- `No, cancel` — stops without side effects, file is kept
- `Edit and retry` — asks the user what to change (repo, title, labels, body file) and restarts the workflow

The prompt MUST include the resolved title, repo, and labels. Never call `gh` before the user explicitly confirms.

## Output format

After a successful publish, reply with two lines:

```
Created issue <url>
Removed draft: <file>
```

Do not add any explanation, summary, or commentary around these lines.

## Error handling

If any precondition fails or `gh` returns non-zero:

- Print the relevant `gh` stderr to the user verbatim.
- Do not retry.
- Do not modify or delete the file.
- Do not attempt workarounds.

If the user declines the confirmation:

- Acknowledge briefly (`Cancelled, no issue created.`)
- Do not run `gh`.
- Do not delete the file.
- Do not ask why.

If the user types `cancel` at the picker:

- Acknowledge briefly.
- Do not run `gh`.
- Do not delete anything.

## What NOT to do

- Do NOT call `gh` for anything other than `issue create` (no PRs, no auth modifications, no API mutations).
- Do NOT run `gh issue create` before the user has explicitly confirmed the publish details.
- Do NOT assume `yes` is present when it is not. The default behaviour is to ask.
- Do NOT push, commit, or stage anything.
- Do NOT run `git` commands at all.
- Do NOT add conversational text, summaries, or recaps around the success lines.
- Do NOT modify the body file. The user has already reviewed it.
- Do NOT delete the body file unless `gh issue create` returned the issue URL on stdout.
- Do NOT create the issue via the GitHub REST API (`curl`) — always use `gh` so the user's existing auth and config are honoured.
- Do NOT add labels via the API as a follow-up; pass `--label` once during creation.
- Do NOT silently re-pick a draft. The picker is always explicit.
