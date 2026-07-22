# Code Review Workflow

This is a review-only task.

## Inputs

- **git diff** against base branch (primary source of truth).
- **Full file context** when needed to understand surrounding code.
- **`docs/architecture.md`** — read the whole file before raising any candidate finding. It is the source of truth for system design, including the "Known review false positives" subsection (findings that look like defects but are by design). Cross-check any candidate against the whole document, not just that subsection, before raising it; if it matches, drop it.

## Responsibilities

- Analyze only changed code.
- Determine the base branch automatically (`master`, `main`, `dev`, or upstream tracking branch).
- Determine what the change is intended to do.
- Detect regressions or unintended behavior changes.
- Assume the author intentionally implemented the feature.
- Prioritize correctness over style.

## Review Mode

- Do not modify files.
- Do not propose large refactors.
- Do not enter planning mode.
- Do not generate implementation steps unless necessary to explain a bug.

## Focus Areas

Review changes for:

- **Business logic correctness**: unintended side effects from logic modifications.
- **API compatibility**: breaking changes to external or internal API contracts.
- **Database risks**: missing indexes, unsafe migrations, raw queries, missing transactions.
- **N+1 queries**: eager loading omissions, loops triggering individual queries.
- **Performance issues**: unnecessary queries, missing caching, inefficient algorithms.
- **Security vulnerabilities**: injection risks, missing authorization checks, exposed secrets.
- **Missing edge cases**: unvalidated input, missing type checks, unchecked return values.
- **Missing tests**: features or fixes that should have corresponding automated tests.

## Explicitly Ignore

Do NOT comment on:

- Formatting or whitespace.
- Naming conventions.
- Style-only feedback.
- Unrelated refactoring suggestions.

## Output Format

### Per-Issue Format

For every finding:

- **Severity**: Critical | High | Medium | Low
- **File**: `path/to/file.php:line`
- **Explanation**: What is wrong and why it matters.
- **Suggested fix**: Concrete code change or approach.

### Final Sections

After the individual findings, include:

#### Overall Risk Score

Rate the changeset 1-10 (1 = trivial/safe, 10 = high risk of breakage). Justify briefly.

#### Suggested Manual QA Areas

List specific user flows or scenarios to manually test in staging, tied to the changed code.

#### Missing Tests

List test classes and methods that should be written to cover the changed logic.

#### Uncertainties

Explain where the review may lack context (e.g., unknown business rules, external dependencies, unclear requirements).
