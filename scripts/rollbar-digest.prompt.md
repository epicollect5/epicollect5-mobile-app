# Weekly Rollbar digest — triage instructions

`REPO` is the repository root. The task prompt sets it to this repository's
absolute path; the scheduled run works in a chat directory that is not the
repository, so every path below goes through it.

## How this is scheduled

Two OpenChamber scheduled tasks read this file and post into one chat, the
"Rollbar digest" chat in OpenChamber's global Chats area:

| Task | When | Model |
| --- | --- | --- |
| `Rollbar weekly digest` | Monday 11:00 Europe/Rome | `opencode/big-pickle` |
| `Rollbar weekly digest (backstop)` | Monday 17:00 Europe/Rome | `opencode/mimo-v2.6-flash-free` |

The backstop has its own extra rule in
`scripts/rollbar-digest-backstop.prompt.md`. Both tasks use a free model, so
both can be refused on a provider quota; the backstop exists for that, and for
the case where the first task's run died before it posted anything.

## 1. Produce the digest

Run `node $REPO/scripts/rollbar-digest.js` and post its Markdown output as the
body of your message, unchanged. The script is the source of truth: versions in
scope, the attention list, the noise summary and the unversioned boot errors.
Do not re-derive any of it, and do not edit it.

The token lives in `$REPO/.env.local` (gitignored, read by the script). Never
print it, never copy it anywhere.

The script retries its own API calls and re-collects when the result looks
broken, and it says so in the digest when it had to. If it still fails, run it
once more, then post a short notice saying the digest could not be produced and
quoting the error. **Never leave the week silent** — an empty chat must never
read as a quiet week.

If the digest says a version was not seen in Rollbar, say so plainly. Silence
is not the same as health: a version that never reported looks identical to a
quiet week.

## 2. Triage the attention items

Triage only the items under "Needs attention", at most 5, most recent first.
For each one:

- `node $REPO/scripts/rollbar-digest.js --evidence <item id>` returns the
  occurrence: source-mapped frames, the app's `custom.context`, the request URL
  and a condensed telemetry timeline. Secrets, tokens, emails and field input
  values are already redacted, so the pack is safe to quote.
- Compare against `origin/master` of `$REPO`, never against the checked-out
  branch. The version an item came from has a release tag
  (`git -C $REPO tag --list '<version>*'`):
  - `git -C $REPO log <tag>..origin/master -- <file>` — what changed since that build
  - `git -C $REPO merge-base --is-ancestor <fix-commit> <tag>` — was the fix in the build
  A fix that landed after the tag is not in the build users are running.
- Give each item exactly one verdict:
  - `NOISE` — deliberate UX, a permission denial, or SDK throttling
  - `FIXED AFTER BUILD` — a fix landed after that version's tag; users need the update
  - `STILL PRESENT` — the failing path is still unguarded on `origin/master`, so it needs a fix
  - `REGRESSION?` — the fix is already in the watched build yet it still happens
  - `UNMAPPED` — minified or moved code; a human has to look

If you cannot work out an item's verdict, say `UNMAPPED` and why. Never drop an
item silently.

## 3. Report

Read-only. Do not edit files, do not commit, do not resolve or mutate anything
in Rollbar. A scheduled run must never change code unattended.

Report only the items that need attention, each with its verdict, the
file:line, and the commit that fixed it or that would have to fix it. Keep
"NOISE" and "FIXED AFTER BUILD" out of the main list, but count them in one
line so the volume is visible.

Then add two or three lines of judgement: what changed since last week, and
whether anything needs the user's attention now. If the top item points at
code you can name, say which file and function to open.
