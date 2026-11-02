# AGENTS.md

## Core Rules

- Do NOT introduce TypeScript
- Do NOT refactor unrelated code
- Do NOT introduce new patterns unless explicitly requested
- Follow existing architecture and conventions from docs/

## Refactoring Rules

A behaviour-preserving refactor changes structure while preserving behaviour, contracts, and trust boundaries.

* Trust existing internal contracts. Tests, established calling patterns, store initialisations, and model invariants are evidence of intended data shapes.
* New guards, validation, fallbacks, catch blocks, or abstractions require a concrete justification — identify the specific boundary or demonstrated failure mode that requires them. The mere possibility that a value could be invalid is not sufficient.
* Unrelated hardening is outside the scope of a refactor.
* Prefer minimal diffs.

## Architecture Constraints

- Components = UI only (no business logic)
- Services = business logic
- Stores = shared reactive state
- Models = domain containers

## Vue Rules

- Use reactive(), NEVER ref()
- No inline logic in templates
- Group structure: state → methods → computedScope
- Always wrap `if`/`else`/`for`/`while` bodies in `{}`, even single statements
- Do NOT place workflow or business logic in components

## Testing

- Use Vitest only
- Always import from 'vitest'
- Use vi.fn(), never jest.fn()
- Always prefix test runs with `NODE_ENV=test` (e.g. `NODE_ENV=test npx vitest run <file>`);
  without it, tests fail with misleading environment errors. The npm scripts
  (`test:unit`, `vitest`) already set it

## Import Paths

- Always import via the `@` alias; do not add relative paths (`../` or `./`)
- `@/*` resolves to `src/*`
- In tests, `@/helpers/*` also resolves to `tests/helpers/*` (test-only alias in
  `vite.config.js`); use it for shared test helpers/harnesses

## Search Tools

- For any file search or grep in the current git-indexed directory, use the fff
  MCP tools (`mcp__fff__find_files`, `mcp__fff__grep`, `mcp__fff__multi_grep`)
  instead of shell grep/ls/sed/find
- For symbol-level questions (call paths, architecture, "how does X work"), use
  codegraph first

## Priority Rules

- docs/CODE-STYLE.md overrides generic Vue best practices
- Always follow existing patterns in the codebase over external examples

## Supported Platforms

Before calling anything a device limitation, a compatibility risk, or a reason
for a fallback, check this matrix. Do NOT reason from a library's caveat, from
generic web advice, or from memory.

- Android (native): `minSdkVersion = 29` — **Android 10** (`android/variables.gradle`)
- iOS (native): `IPHONEOS_DEPLOYMENT_TARGET = 16.0` — **iOS 16**
  (`ios/App/App.xcodeproj/project.pbxproj`, `ios/App/Podfile`)
- PWA: **Chrome/ChromeAndroid/Edge 89+, Firefox 75+, Safari 16+, iOS 16+** —
  declared in `.browserslistrc` (a support policy: `build.target` is what the
  build actually enforces)
- Build baseline: `target: 'es2020'` (`vite.config.js`) — the code is compiled
  for ES2020 and nothing older
- WebView: Android 10 ships Chromium 74 and WebView updates through Play Store
  toward the `ChromeAndroid 89` target in `.browserslistrc`; iOS 16 ships
  Safari 16

Rules:

* Do NOT add a fallback, polyfill, feature detection or "old device" branch for
  a capability every version in this matrix has. WebAssembly, ES2020 syntax,
  modules, async/await, BigInt, `Intl` and modern array methods are all present,
  on the PWA as much as in the native WebViews.
* Before writing "unsupported device", "some WebViews may not support X", or a
  degradation path, name the exact version that lacks the feature **and** a
  source for its availability. If no version inside the matrix lacks it, do not
  write the fallback and do not raise it as a risk.
* When such a capability does fail on a supported device, that is a **defect**
  (memory pressure, damaged bundle, a policy blocking it), not a device class:
  report it (Rollbar) and let it fail loudly. A silent fallback hides the defect
  for months.
* State a matrix fact, not a device story: "Android 10+ has WebAssembly" beats
  "some older devices may not support the regex engine".

## System Risks Check (MANDATORY for new features)

Applies to: **new features, new data flows, new persistence/state, and new external integrations.**
Does **not** apply mechanically to behaviour-preserving refactors — see Refactoring Rules above.

For work in scope, do NOT assume correctness. Identify how the new behaviour can break.

You MUST:

* List ways data can become stale or inconsistent
* Check what happens when underlying data changes or is removed
* Consider failures: network, partial execution, concurrency
* Identify anything cached/stored and when it becomes invalid
* Consider side effects on other parts of the system
* Verify every device or capability assumption against **Supported Platforms**
  before listing it as a risk

List at least three concrete risks specific to the new behaviour.
If none, justify why for each point.

Assume this runs at scale and causes inconsistencies after months in production.

## Git

Commit messages follow Conventional Commits:

- Format: `<type>(<scope>): <description>` — scope is optional for docs, test and chore commits
- Allowed types: feat, fix, refactor, perf, docs, test, build, ci, chore, style, revert
- Use imperative mood (e.g. "add", "fix", "remove")
- Do not capitalize the first word of the description
- Do not end the description with a period
- Maximum 75 characters total, including type and scope
- If the change includes both a fix and a feature, prefer the type that best reflects the primary purpose

## Source of Truth

- Architecture → docs/ARCHITECTURE.md
- Code style → docs/CODE-STYLE.md
- Database → docs/DATABASE-SCHEMA.md
- JSON schemas → src/schemas/*
- Custom agent commands → .agents/skills/*/SKILL.md (canonical; wrappers in .opencode/commands/)
