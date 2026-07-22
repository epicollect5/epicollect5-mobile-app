# AGENTS.md

## Core Rules

- Do NOT introduce TypeScript
- Do NOT refactor unrelated code
- Do NOT introduce new patterns unless explicitly requested
- Follow existing architecture and conventions from docs/

## Architecture Constraints

- Components = UI only (no business logic)
- Services = business logic
- Stores = shared reactive state
- Models = domain containers

## Vue Rules

- Use reactive(), NEVER ref()
- No inline logic in templates
- Group structure: state → methods → computedScope
- Do NOT place workflow or business logic in components

## Testing

- Use Vitest only
- Always import from 'vitest'
- Use vi.fn(), never jest.fn()

## Priority Rules

- docs/CODE-STYLE.md overrides generic Vue best practices
- Always follow existing patterns in the codebase over external examples

## System Risks Check (MANDATORY)

For any feature, do NOT assume correctness. Identify how it can break.

You MUST:

* List ways data can become stale or inconsistent
* Check what happens when underlying data changes or are removed
* Consider failures: network, partial execution, concurrency
* Identify anything cached/stored and when it becomes invalid
* Consider side effects on other parts of the system

List at least three concrete risks.
If none, justify why for each point.

Assume this runs at scale and causes inconsistencies after months in production.

## Source of Truth

- Architecture → docs/ARCHITECTURE.md
- Code style → docs/CODE-STYLE.md
- Database → docs/DATABASE-SCHEMA.md
- JSON schemas → src/schemas/*
