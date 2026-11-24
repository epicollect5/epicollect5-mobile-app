# Agent commands

Canonical source for every custom command/skill in this repository.

## Canonical location

```
.agents/skills/<name>/SKILL.md   # one directory per command, file must be named SKILL.md
```

Each `SKILL.md` has frontmatter `name` (must match directory) + `description` and a Markdown body. This is the [Agent Skills](https://agentskills.io) standard (also called "agentskills").

Edit **only** these files to change a command. Every other location is a thin wrapper that must not duplicate the body.

## Per-agent mapping

| Agent | How it discovers the canonical skill | Native invocation | Wrapper needed? |
|---|---|---|---|
| **Command Code** | `.agents/skills/` — natively, shows `[.agents]` badge in `/skills` | `/<name>` or `/skill:<name>` | No |
| **OpenCode** | `.agents/skills/` — via `skill` tool (also lists `.agents/skills` automatically) | `/<name>` via wrapper | Optional local wrapper — `.opencode/commands/<name>.md` (gitignored) |
| **Codex CLI** | `.agents/skills/` — every level from `cwd` up to repo root (+ `~/.agents/skills/`) | `$<name>` / `/skills` picker / implicit | No |
| **Claude Code / Cursor / Gemini CLI** | `.agents/skills/` — via the same standard | `/<name>` or skill picker | No |

Wrappers:

- `.opencode/commands/<name>.md` — optional local wrapper (not tracked; `.opencode/` is gitignored). If you need `/<name>` in OpenCode, create it locally with frontmatter `description` + `agent: build`, and a body that forwards to `.agents/skills/<name>/SKILL.md` and passes `$ARGUMENTS` through verbatim without interpreting it.

Do not add tracked native commands/skills under `.commandcode/commands/`, `.claude/skills/`, `.cursor/`, etc. to avoid shadowing the canonical source. If a harness complains about a missing `/<name>`, add a local wrapper that references the canonical file — never copy the body.
