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
- The Baseline Regression Suite below is always emitted on top of the diff-derived checks; it is exempt from the "No duplicates" rule.

## Baseline Regression Suite (always included)

Every QA report MUST include the checks below, regardless of the diff. They are emitted even when the change does not touch layout, insets, navigation, or question rendering, and they are **not** diff-derived.

Do not deduplicate them against diff-derived checks, and do not drop them when the diff is small or unrelated. They are the standing guard for the shared Android inset configuration (`capacitor.config.json` `SystemBars`/`EdgeToEdge`, `src/components/globals/BaseLayout.vue`, `LeftDrawer.vue`, `RightDrawer.vue`), where a change to one surface silently breaks another, and (B7-B8) for the shared DATE and TIME question components (`QuestionDate.vue`, `QuestionTime.vue` and the entries-filter date fields), whose native pickers have regressed before on Android WebView updates.

### B1. Status bar does not overlap or double-pad content

- **Test Description:** Confirm routed page content starts below the status bar on the oldest and newest supported Android versions.
- **Expected Result:** The header is fully visible below the status bar with no content underneath it and no blank strip between the status bar and the header.
- **Manual Action:** On Android 10 and Android 16 staging devices; open the Projects list and an Entries list and a routed question page; in each confirm the header clears the status bar and that no gap appears above it.

### B2. GROUP question keyboard and bottom scroll

- **Test Description:** Confirm the final inputs of a GROUP question remain reachable while the soft keyboard is open.
- **Expected Result:** With the keyboard open scrolling to the maximum reveals the final 2-3 GROUP inputs; nothing is trapped behind the keyboard; dismissing it leaves no residual gap.
- **Manual Action:** On Android 16 staging open an entry containing a GROUP question with at least 3 inputs; focus the last input; let the keyboard open; scroll to the bottom; confirm every input is reachable; dismiss the keyboard and confirm the layout returns with no gap.

### B3. Drawer content scrolls clear of the navigation bar

- **Test Description:** Confirm both drawers scroll fully and their last item clears the navigation bar.
- **Expected Result:** The final item in each drawer scrolls fully into view above the navigation bar or gesture indicator; no item stays permanently obscured.
- **Manual Action:** On Android 10 and Android 16 staging devices; open the left drawer and scroll to its last item; then open the right drawer and scroll to its last item; confirm both are fully visible and tappable above the navigation controls.

### B4. Google login and logout (Android and iOS)

- **Test Description:** Confirm Google sign-in establishes a session and logout clears it on native staging builds.
- **Expected Result:** The account picker opens; approved sign-in lands on authenticated home with the user persisted across restart; logout returns to the login screen and cold restart stays logged out.
- **Manual Action:** On a staging Android fresh install tap Sign in with Google; pick the staging test account and approve; confirm home and Projects load; open account/settings and Log out; confirm the login screen; force-close and reopen and confirm still logged out; repeat the same sequence on staging iOS.

### B5. Email passwordless login and logout (Android and iOS)

- **Test Description:** Confirm passwordless email code login establishes a session and logout clears it on native staging builds.
- **Expected Result:** The code is requested and accepted; sign-in lands on authenticated home with the user persisted across restart; logout returns to the login screen and cold restart stays logged out.
- **Manual Action:** On a staging Android fresh install choose Email login; enter the staging test email and request the code; enter the received code; confirm home and Projects load; open account/settings and Log out; confirm the login screen; force-close and reopen and confirm still logged out; repeat the same sequence on staging iOS.

### B6. Apple login and logout (iOS only)

- **Test Description:** Confirm Sign in with Apple establishes a session and logout clears it on staging iOS.
- **Expected Result:** The Apple sheet opens; approved sign-in lands on authenticated home with the user persisted across restart; logout returns to the login screen and cold restart stays logged out.
- **Manual Action:** On a staging iOS fresh install tap Sign in with Apple; approve with the staging test Apple ID; confirm home and Projects load; open account/settings and Log out; confirm the login screen; force-close and reopen and confirm still logged out.

### B7. DATE question picker and value layout

- **Test Description:** Confirm the DATE question field opens its picker on the first tap and lays out its value correctly on native staging builds.
- **Expected Result:** Tapping anywhere in the date field opens the date picker on the first tap (no focus-only dead tap); an untouched empty field shows no placeholder segments such as `gg/mm/aaaa` and reads as empty; a selected date is shown centred within the field; the clear (X) icon empties the field; the from/to date fields in the entries-list filter modal open the picker the same way.
- **Manual Action:** On Android 10 and Android 16 staging (and iOS); open a form with a DATE question; tap the field and confirm the picker opens on the first tap; select a date and confirm it appears centred in the field; tap the clear icon and confirm the field is empty again; leave another date question untouched and confirm no placeholder segments are shown; open the entries-list filter modal and confirm its from/to date fields also open the picker on the first tap.

### B8. TIME question picker and value layout

- **Test Description:** Confirm the TIME question field opens the matching picker on the first tap and lays out its value correctly on native staging builds.
- **Expected Result:** Tapping anywhere in a no-seconds time field (e.g. `HH:mm` or `hh:mm`) opens the clock picker on the first tap; a seconds format (e.g. `HH:mm:ss` or `mm:ss`) opens the wheel picker on the first tap; a selected time is shown centred within the field; the clear (X) icon empties the field; an untouched empty field shows no placeholder segments such as `--:--`.
- **Manual Action:** On Android 10 and Android 16 staging (and iOS); open a form with TIME questions in a no-seconds format and a seconds format; tap each field and confirm the matching picker opens on the first tap; select a time and confirm it appears centred in the field; tap the clear icon and confirm the field is empty again; leave another time question untouched and confirm no placeholder segments are shown.

B1-B8 are emitted as CSV rows like any other check - apply the comma substitution rule to them too. Android is where the inset failure modes live; run the same B1-B3 steps on iOS as a cross-platform sanity check since all three surfaces exist there. B4 and B5 run on Android and iOS with `PWA` pre-filled to `N/A`. B6 runs on iOS only with `Android` pre-filled to `N/A` and `PWA` pre-filled to `N/A`. B7 and B8 run on Android and iOS and also on PWA (the DATE and TIME questions exist on all three platforms) so do not pre-fill their cells with `N/A`. Mark the cell `N/A` where a surface is absent on PWA.

## Output Format

### 1. QA Report (Markdown file)

Grouped by feature or area.

### 2. QA CSV file (.csv)

Columns: `Action Description` | `Expected` | `Android` | `iOS` | `PWA`

> The `|` above is markdown table/list notation for readability only — it is NOT the file separator. The `.csv` file must be a standard comma-separated file (commas delimit columns), so it imports cleanly into Google Sheets.

- One row per QA check.
- Action must describe a human action in staging.
- Expected must describe observable result.
- The platform columns (`Android`, `iOS`, `PWA`) are filled in during the QA process to record the outcome per platform (e.g. PASS/FAIL or any device-specific notes).
- Android and iOS are always targeted. PWA is a smaller subset: rows whose feature is absent on PWA (inferred from the code) are pre-filled `N/A` at generation time; the remaining rows are executed on PWA and their cell is filled during QA.
- If a check is not applicable on a given platform, record that explicitly (e.g. N/A) instead of leaving it blank.
- Commas are used only as column separators, never inside cell text.
- Inside `Action Description` and `Expected`, replace commas with `;` to separate step lists or clauses, so they never collide with the comma column separator and the CSV imports cleanly into Google Sheets (the `|` in this doc's column list above is just markdown notation, not a separator in the file).
- Cell text must stay comma-free; no quoted/escaped fields are needed.

## Validation Rules

Before output, ensure:

- Full coverage of changes.
- No duplicates.
- All steps reproducible in staging.
- Diff fully mapped to QA checks, plus the Baseline Regression Suite.
- The Baseline Regression Suite is present in both the Markdown report and the CSV.
- No commas inside CSV cell text; commas only separate columns.
