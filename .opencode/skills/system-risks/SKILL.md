---
name: system-risks
description: Perform the mandatory System Risks Check from AGENTS.md for a changed service, component, or feature. Enumerates concrete failure modes (staleness, data removal, network/partial/concurrency failures, cache invalidation, side effects). Use after any feature or service change, or when the user asks to review risks.
---

# System Risks Check

AGENTS.md makes a System Risks Check **mandatory** for any feature: "Do NOT assume
correctness. Identify how it can break." This skill scaffolds that check so it is
consistent and complete.

## When to use

- After implementing or reviewing a feature/service change.
- When the user asks for a "system risks check", "risk review", or "how can this break".
- Trigger especially for stateful services such as `src/services/entries-download-service.js`,
  `src/services/upload-data-service.js`, `src/services/entry/*`, and `src/stores/*`.

## Inputs

The changed file(s) or a description of the change. Prefer reading the actual
implementation via Codegraph or Read before assessing.

## Procedure

For the change under review, walk ALL of the following categories and produce at least
**three concrete risks**. If a category genuinely does not apply, justify why in one
line — do not omit it silently.

1. **Stale / inconsistent data**
   - Ways in which data can become stale or inconsistent.
   - Cached responses, derived state, or indexed values that drift from source.

2. **Underlying data changed or removed**
   - What happens when a referenced record, schema field, project, or entry is deleted
     or altered after being read.
   - Orphaned references, missing-key access, broken foreign assumptions.

3. **Failures: network, partial execution, concurrency**
   - Network drop / timeout mid-request.
   - Partial execution: a step succeeds then a later step fails (e.g. media uploaded but
     entry not, or vice versa).
   - Concurrency: simultaneous edits, overlapping uploads/downloads, race on shared store.

4. **Cached / stored state and invalidation**
   - Anything cached or persisted (IndexedDB, store, filesystem, local state).
   - Exactly when it becomes invalid and how invalidation is (or is not) triggered.

5. **Side effects on other parts of the system**
   - Downstream consumers: other stores, components, sync, export, upload queues.
   - Cross-form / parent-child entry effects.

## Mindset

- Assume the app runs at scale and the inconsistency surfaces only after months in
  production.
- Each risk must be concrete and tied to a specific code path or data flow, not generic.
- Where unsure, state the assumption that could break.

## Output format

For each risk:

- **Category**: one of the 5 above.
- **Risk**: what can go wrong, concretely.
- **Trigger**: the condition/sequence that causes it.
- **Impact**: observable failure (data loss, duplicate, crash, silent wrong value).
- **Mitigation** (if obvious): the guard, transaction, retry, or invalidation that
  prevents it.

End with a one-line summary of overall risk and the single most important gap to close.
