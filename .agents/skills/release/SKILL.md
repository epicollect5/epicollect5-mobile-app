---
name: release
description: Cut a mobile-app release — bump version across native + web config and prepend changelog release notes
---

# Release

Cut a new release. Given an optional release number, determine the version, bump it
across the version files, and prepend release notes to `CHANGELOG.md`.

## Inputs

- `number` (optional): a build number (e.g. `9800`) or full version (`98.0.0`).
  When omitted, the skill suggests the next version and asks for confirmation.

## Versioning scheme

  versionName = `<IonicMajor><CapacitorMajor>.<appMinor>.<appPatch>`
  buildNumber = versionName with the dots removed        (e.g. `98.0.0` -> `9800`)

- `IonicMajor` comes from `@ionic/core` / `@ionic/vue` in `package.json`.
- `CapacitorMajor` comes from `@capacitor/core` in `package.json`.
- The 2-digit prefix only works while both framework majors are single digit.
  When either reaches 10 the concatenation no longer fits: recommend a version
  and explicitly flag the mismatch — do not silently fake the encoding.

## Steps

1. Read current state
   - `package.json` -> `version`
   - `android/app/build.gradle` -> `versionCode`, `versionName`
   - `ios/App/App.xcodeproj/project.pbxproj` -> `MARKETING_VERSION` (Debug + Release),
     `CURRENT_PROJECT_VERSION` (Debug + Release)
   - installed majors: grep `@ionic/*` and `@capacitor/core` in `package.json`
   - previous release tag: highest `X.Y.Z` git tag below the new version, or the
     commit that introduced the current `package.json` version (fallback to recent log)

2. Determine the new version
   - If `number` is all digits (build): reconstruct the canonical version using the
     framework prefix (`IonicMajor*10 + CapacitorMajor`) as the leading digits; if
     ambiguous, ask the user.
   - If `number` is `X.Y.Z`: validate the `XY` prefix matches the framework majors;
     warn and confirm if it does not.
   - If no `number`: compute `prefix = IonicMajor*10 + CapacitorMajor`.
     - If `prefix` differs from the current version's leading two digits, the
       framework major changed -> suggest `<prefix>.0.0`.
     - Else suggest a patch bump `<prefix>.<minor>.<patch+1>`; for a feature/minor
       release ask whether to bump `appMinor` instead.
   - Print the suggestion and derived build number; proceed only after confirmation
     (or immediately when an explicit `number` was passed).

3. Compute `buildNumber` = new `versionName` with dots removed.

3a. **Android edge-to-edge gate** (mandatory before proceeding):
   - Run `npx vitest run tests/unit/edge-to-edge.spec.js`. It asserts the pin is exact
     (no caret), that `package-lock.json` resolves the same version, that
     `SystemBars.insetsHandling` is `"disable"`, and that the EdgeToEdge plugin is present
     in the committed Android wiring. If it fails, **stop** - do not hand-verify.
   - Install with `npm ci`, never `npm install`, for a release. `npm install` rewrites the
     pin to a caret (npm's default `save-prefix`), and a lockfile refresh silently resolves
     8.0.8, which reintroduces the keyboard regression.

3b. **Physical Android QA** (required before release):
   - Run the **Baseline Regression Suite** in `docs/workflows/qa.md` in full: B1 (status
     bar), B2 (GROUP question keyboard and bottom scroll), B3 (drawer scroll). Mandatory on
     every release, not only when the diff touches insets, because these surfaces share one
     inset configuration.
   - Add the release-specific checks on top: modal and camera-preview geometry.
   - iOS: sanity open (no crash).
   - Record results in `docs/QA-<version>.md`.

4. Apply edits (exact string replacement, preserve indentation)
   - `package.json`: `"version": "<new>"`
   - `android/app/build.gradle`: `versionCode <build>` and `versionName "<new>"`
   - `ios/App/App.xcodeproj/project.pbxproj`:
       - `MARKETING_VERSION = <new>`  (both Debug and Release)
       - `CURRENT_PROJECT_VERSION = <build>`  (both Debug and Release)
   - Risk: the iOS build number is easy to miss — it MUST equal the same build used
     for Android `versionCode`, or store uploads desync.

5. Generate release notes
   - `git log --oneline <base>..HEAD` (base = previous release tag/commit).
   - Collapse commits into concise, user-facing bullets grouped by area
     (features, fixes, build/migration, tests); drop internal/CI-only commits.
   - Prepend to `CHANGELOG.md` right after the `## Release Notes` line:
     `# <new> - build <build>` followed by ` - ...` bullets.
   - Mirror the existing bullet style (` - ` / `- `).

6. Validate
   - `npx vitest run tests/unit/changelog.spec.js` (enforces heading format,
     uniqueness, and that the package version has notes).
   - `npx vitest run tests/unit/edge-to-edge.spec.js` (re-asserts the pin and the native
     wiring after the version bump has touched `package.json`).

7. Report and confirm follow-up
   - Show version, build, and changed files.
   - Ask whether to commit (`chore: release <new> (build <build>)`) and create an
     annotated tag (`<build>`, e.g. `9800`). Do not commit or tag unless confirmed.

## Constraints (AGENTS.md)

- Do NOT introduce TypeScript or new patterns.
- Follow existing architecture/conventions.
- System risk check: Android `versionCode` and iOS `CURRENT_PROJECT_VERSION` must
  stay equal to the same build number; a mismatch breaks store uploads.
