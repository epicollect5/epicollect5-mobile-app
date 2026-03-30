# ESLint & Style Rules
You must follow these rules strictly. If you generate code that violates these, it will fail build.

- **Semicolons**: ALWAYS use semicolons at the end of statements (`'semi': ['error', 'always']`).
- **Quotes**: Use SINGLE quotes for strings (`'quotes': ['error', 'single']`).
- **Commas**: NEVER use trailing commas (`'comma-dangle': [1, 'never']`).
- **Variables**: Prefer `const` over `let`, and NEVER use `var`.
- **Vue Components**:
    - Disable multi-word component name checks.
    - Follow this specific order for component options: props, emits, setup, data, computed, watch, methods.
- **Environment**: This is a Vue 3 project with Cordova globals enabled.
# Testing Requirements
- **Framework**: Use Vitest for all tests. Never use Jest.
- **Imports**: Always import testing functions from 'vitest' (e.g., `import { describe, it, expect, vi } from 'vitest';`).
- **Mocks**: Use `vi.fn()` or `vi.spyOn()` instead of `jest.fn()` or `jest.spyOn()`.
- **Globals**: Even if globals are enabled in `vite.config.js`, explicitly include imports in generated snippets to ensure type safety.
