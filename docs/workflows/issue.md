# Issue Draft Workflow

Convert the current session's approved plan into a GitHub-issue-ready Markdown document, and save it as a draft to `docs/issues/draft/<slug>.md` so the second-step `/publish-issue` command can pick it up.

## Inputs

- The implementation plan produced in the current conversation (plan-mode output or recent assistant turns).
- `$ARGUMENTS` (optional): additional context, constraints, or a `title: <text>` override.

## Source of truth

- The plan produced in this conversation is the only source of truth.
- Do NOT scan the repository.
- Do NOT read files unless explicitly required to resolve an ambiguity in the plan.
- Do NOT introduce new requirements, solutions, refactors, or scope.

## Responsibilities

Produce ONE Markdown document optimized for:

- human review as a GitHub issue
- later AI implementation from the issue alone

The issue must preserve the technical intent and decisions from the original plan.

## Output format

Output the issue body as plain Markdown.

Do not add any explanation before or after the issue body.

Inside the issue body, use this structure in order:

# <Title>

Concise imperative title, <= 70 characters.

## Summary

2-4 sentences describing what changes and why.

## Context

Relevant background from the plan.

Include:

- existing behaviour
- problem being solved
- affected components
- file paths or references mentioned in the plan

Do not invent file paths or line numbers.

## Goal

Single sentence describing the intended outcome.

## Proposed Plan

Convert the plan into numbered implementation steps.

Requirements:

- Each step must be small enough for an AI coding agent to execute.
- Preserve implementation order.
- Include exact file paths, classes, functions, commands, or configuration details only when present in the plan.
- Preserve test, lint, migration, or build commands verbatim when provided.

Example:

1. Update `app/Services/UserService.php` to validate the new workflow.
2. Add coverage in `tests/Feature/UserTest.php`.
3. Run `vendor/bin/phpunit --no-progress tests/Feature/UserTest.php`.

## Acceptance Criteria

Convert requirements into a checkbox list.

Rules:

- Each item must be objectively verifiable.
- Criteria must describe the final expected behaviour.
- Do not add criteria not present in the plan.

Format:

- [ ] ...

## Out of Scope

Explicitly list excluded work.

If the plan does not define exclusions, write:

> None specified.

## References

Include only references present in the plan:

- file paths
- file:line references
- documentation links
- related issues or PRs

## AI Implementation Context

This issue is intended to be used as an implementation specification.

Implementation MUST:

- follow `AGENTS.md`
- follow repository workflow documentation
- satisfy every acceptance criterion
- complete every proposed implementation step
- avoid unrelated refactoring or scope expansion

If requirements are ambiguous:

> TODO: clarify missing requirement before implementation

## Save draft (mandatory)

After outputting the body, also save it to a draft file:

1. Take the title (the text after `# ` in the first H1 of the body).
2. Compute a slug: lowercase, replace any run of non-alphanumeric characters with `-`, strip leading/trailing `-`, cap at 80 characters.
3. Write the full body (including the H1) to `docs/issues/draft/<slug>.md` using the Write tool, creating `docs/issues/draft/` if it does not exist.
4. If a draft with the same slug already exists, overwrite it. Do not create numbered variants.

Do not mention the saved file path in the body output — the body is strict. The path is the agent's implementation detail and is read by `/publish-issue` automatically.

## Style rules

- No emojis.
- No conversational tone.
- Use imperative voice for implementation steps.
- Preserve technical terminology from the plan.
- Preserve commands verbatim.
- Do not hallucinate missing details.

## What NOT to do

- Do NOT call `gh`.
- Do NOT scan the repository.
- Do NOT add text outside the issue body.
- Do NOT mention the saved draft path in the user-facing output.
