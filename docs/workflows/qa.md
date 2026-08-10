# QA Generation Workflow

Generate QA documentation from a codebase change or QA spec file.

## Inputs

- base_ref (default: master)
  Branch, tag, or commit SHA

- qa_spec_file (optional)
  docs/QA-{version}.md

## Diff scope

git diff {{base_ref}}..HEAD

## Reconciliation logic

If QA spec exists:

- Use it as reference documentation
- Compare against git diff results
- Ensure all new changes are covered in QA output

## Responsibilities

Identify all user-impacting changes across:

- Feature changes
- New endpoints/controllers
- Migrations/schema changes
- Authentication/authorization changes
- Frontend/UI changes
- API contract changes
- Business logic changes
- Configuration changes, listing all new or modified .env variables

## QA Generation Rules

For every meaningful change, generate at least one QA check.

Each QA check must include:

- **Test Description** — what is being tested.
- **Expected Result** — what success looks like.
- **Manual Action** — step-by-step staging instructions.

Rules:

- Must be executable in staging.
- No abstract descriptions.
- No unit/integration test instructions.
- Full coverage of changes required.
- No duplicates.

## Output Format

### 1. QA Report (Markdown file)

Grouped by feature or area.

### 2. QA CSV file (.csv)

Columns: `Action Description` | `Expected` | `Android` | `iOS` | `PWA`

- One row per QA check.
- Action must describe a human action in staging.
- Expected must describe observable result.
- The platform columns (`Android`, `iOS`, `PWA`) are filled in during the QA process to record the outcome per platform (e.g. PASS/FAIL or any device-specific notes).
- Android and iOS are always targeted. PWA is a smaller subset: rows whose feature is absent on PWA (inferred from the code) are pre-filled `N/A` at generation time; the remaining rows are executed on PWA and their cell is filled during QA.
- If a check is not applicable on a given platform, record that explicitly (e.g. N/A) instead of leaving it blank.
- Commas are used only as column separators, never inside cell text.
- Inside `Action Description` and `Expected`, replace commas with `;` (preferred, since `|` already denotes the column list in this doc) to separate step lists or clauses, so the CSV imports cleanly into Google Sheets.
- Cell text must stay comma-free; no quoted/escaped fields are needed.

## Validation Rules

Before output, ensure:

- Full coverage of changes.
- No duplicates.
- All steps reproducible in staging.
- Diff fully mapped to QA checks.
- No commas inside CSV cell text; commas only separate columns.
