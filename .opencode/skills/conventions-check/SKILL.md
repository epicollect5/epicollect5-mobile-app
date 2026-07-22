---
name: conventions-check
description: Audit a file or diff against the Epicollect5 code-style and ESLint rules. Report-only (never edits files). Use when the user asks to "check conventions", "lint guard", or verify a change follows the repo's Vue/JS style.
---

# Conventions Check (report-only)

Audit target code against `docs/code-style.md` and `.eslintrc.js`. This skill is
**report-only**: it MUST NOT modify files. It returns a severity-tagged list and lets
the user decide fixes. This matches the philosophy of the `/review` command.

## When to use

- User asks to "check conventions", "lint guard", or validate style of a file/diff.
- After generating or editing Vue/JS to confirm compliance before commit.

## Sources of truth

- `docs/code-style.md` — architecture, Vue style, testing rules.
- `.eslintrc.js` — semicolons, quotes, comma-dangle, var/let/const, Vue option order.
- `AGENTS.md` — core rules (no TypeScript, no unrelated refactors, architecture layers).

## Checks to perform

Against the target file(s):

- **`ref()` usage** — forbidden. Must use `reactive()`. Flag every `ref(` occurrence.
- **TypeScript** — forbidden. Flag `interface`, `type`, `: <Type>` annotations, `.ts`
  files introduced.
- **Inline template logic** — forbidden. Flag inline arrow functions and complex
  expressions in `<template>`. Bind to `methods`/`computedScope` instead.
- **Grouped structure** — flag components missing the `state → methods → computedScope`
  grouping, or that spread `state` in the return.
- **ESLint** — semicolons always; single quotes; no trailing commas; `const` over `let`,
  never `var`.
- **Vue option order** — `props → emits → setup → data → computed → watch → methods`.
- **Business-logic placement** — flag business logic / API calls embedded in components
  that belong in `src/services/`; shared state that belongs in `src/stores/`.
- **Testing (if a spec)** — flag `jest.fn()`/`jest.spyOn()` (must be `vi.*`), and missing
  `import { ... } from 'vitest'`.

## Output format

A list, each item:

- **Severity**: Critical | High | Medium | Low
- **File**: `path/to/file:line`
- **Rule**: which convention is violated.
- **Finding**: what is wrong.
- **Suggested fix**: concrete change (do NOT apply it).

End with a short summary: total violations by severity, and whether the file is safe to
commit. Do not rewrite or edit any file.
