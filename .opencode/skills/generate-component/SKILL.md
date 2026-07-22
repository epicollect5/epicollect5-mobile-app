---
name: generate-component
description: Scaffold a Vue component, page, modal, or composable for the Epicollect5 mobile app following the repo's strict code-style conventions (reactive-only, state→methods→computedScope grouping, mirrored scss). Use when the user asks to create or add UI, a component, a page, a modal, or a composable.
---

# Generate Component

Scaffold a new Vue artifact for the Epicollect5 mobile app that conforms to
`docs/code-style.md` and the real component patterns in `src/`.

## Source of truth

- Canonical template: `.opencode/skills/generate-component/assets/ExampleComponent.vue`
  (distilled from `src/components/lists/ListEntries.vue`).
- Style rules: `docs/code-style.md`.
- ESLint: `.eslintrc.js`.

## When to use

Trigger on requests such as "create a component", "add a page", "new modal",
"scaffold a composable", or any UI addition.

## Procedure

1. Identify the artifact type and target directory:
   - Reusable UI component → `src/components/<area>/<Name>.vue`
   - Route-level page → `src/pages/<Name>.vue`
   - Modal → `src/components/modals/<Name>.vue`
   - Reusable Vue composition logic → `src/composables/<area>/<name>.js`

2. Start from the canonical template
   `.opencode/skills/generate-component/assets/ExampleComponent.vue` and adapt it to
   the feature. Do NOT invent a different structure.

3. Preserve these mandatory patterns:
   - `state = reactive({ ... })` — NEVER `ref()`. Keep state grouped in one object.
   - `methods = { ... }` for all actions.
   - `computedScope = { ... }` for all derived values (use `computed()`).
   - Return shape (order matters): `{ state, labels, ...methods, ...computedScope }`.
   - NEVER spread `state` in the return.
   - Read props with `readonly(props)` / `toRefs(props)`; never mutate props.
   - Template: no inline logic, no inline arrow functions. Bind only to methods/
     computedScope. Component option order: `props → emits → setup → data → computed →
     watch → methods`.

4. Styles: emit the `<style src="@/theme/.../<Name>.scss" lang="scss"></style>` block and
   create the mirrored scss file. The `src/theme/` tree mirrors `src/components/` (and
   pages/modals) 1:1. Example: `src/components/answers/Foo.vue` →
   `src/theme/components/answers/Foo.scss`.

5. ESLint hardening (violations fail the build):
   - Semicolons always.
   - Single quotes for strings.
   - No trailing commas.
   - `const` over `let`, never `var`.
   - No TypeScript. No React-style patterns.

6. Architecture boundary: components/pages orchestrate UI only. Put business logic,
   API calls, and workflows in `src/services/`. Put shared reactive state in
   `src/stores/`. Do NOT introduce new patterns unless explicitly requested.

## Output

Produce the `.vue` (or `.js` composable) file content and the mirrored `.scss` file
content. State which directory each belongs in. If the feature needs business logic,
note the `services/` module it should call rather than embedding it.

Do NOT refactor unrelated code. Do NOT add comments to generated code unless the user
asks.
