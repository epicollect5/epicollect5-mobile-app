---
name: scaffold-test
description: Generate a Vitest spec for the Epicollect5 mobile app matching the repo's test conventions (tests/unit layout, vi.* mocks, pinia setup). Use when the user asks to "add a test", "write a spec", or cover a service/composable/store/component.
---

# Scaffold Test

Generate a Vitest spec that matches the repo's existing test conventions, verified from
`tests/unit/entry/answer-service/parseAnswerForViewing.spec.js` and sibling specs.

## When to use

- User asks to "add a test", "write a spec", or cover a service, composable, store, or
  component.

## Test conventions (mandatory)

- **Framework**: Vitest only. Never Jest.
- **Imports**: `import { describe, it, expect, vi } from 'vitest';` — always explicit.
- **Mocks**: `vi.fn()` / `vi.spyOn()` only. Never `jest.fn()` / `jest.spyOn()`.
- **Location**: `tests/unit/<area>/<name>.spec.js`. Mirror the source module path
  under `tests/unit/` (e.g. `src/services/entry/answer-service.js` →
  `tests/unit/entry/answer-service/answer-service.spec.js`).
- **Stores**: wrap store-using tests with `setActivePinia(createPinia())` in
  `beforeEach`.
- **Nested module load failures**: existing specs use `vi.mock('@/services/errors-service', ...)`
  to avoid hard-to-load UI modules. Apply the same pattern when a tested module pulls in
  components or native/Capacitor globals.

## Procedure

1. Identify the unit under test (service / composable / store / component) and its
   public API.
2. Choose the matching `tests/unit/...` path.
3. Generate the spec:
   - Correct `vitest` imports.
   - `describe`/`it` blocks named after the behavior under test (use `PARAMETERS`
     constants where the existing specs do, e.g. `it(PARAMETERS.QUESTION_TYPES.TEXT, ...)`).
   - `vi.mock(...)` for any module that fails to load in the test env.
   - For stores: `setActivePinia(createPinia())` in `beforeEach`.
4. For **components**, test through the public `state` / `methods` returned from `setup`
   — do NOT reach into internals. Prefer mocking the child components or composables the
   component depends on.
5. Reference the real `services/` / `stores/` / `models/` the unit uses; do not invent
   paths.

## Output

Produce the full `.spec.js` file content and the exact path it should be written to.
Do NOT modify application source. Do NOT introduce TypeScript.
