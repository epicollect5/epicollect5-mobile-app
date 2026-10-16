---
name: release
description: Cut a mobile-app release — bump version across native + web config, prepend changelog release notes, and attach the signed APK to the GitHub Release
---

# Release

Cut a new release. Given an optional release number, determine the version, bump it
across the version files, prepend release notes to `CHANGELOG.md`, then verify the
production Android bundle and attach the signed APK to the GitHub Release.

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

0. **Full test suite gate** (mandatory first, before any state reads or edits):
   - Run `node scripts/check-node-version.js && NODE_ENV=test npx vitest --run --silent`.
     Both prefixes are load-bearing, never simplify them away: the node check
     enforces the `engines` requirement (agent shells can resolve an older Node),
     and the explicit `NODE_ENV=test` overrides whatever the agent shell inherits.
     A shell exporting `NODE_ENV=production` makes Vite externalize Node builtins
     (`path`, `fs`) to empty browser stubs, which fails every spec importing them
     (`default.resolve is not a function`) even though the repo is green.
   - If any test fails, **stop immediately** — do not bump versions, edit the
     changelog, commit, or tag. Report the failing files/tests and warn the user
     to fix them first; resume the release only once the suite is fully green.

1. Read current state
   - `package.json` -> `version`
   - `package-lock.json` -> both `"version"` fields (must agree with `package.json`)
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
   - Run `NODE_ENV=test npx vitest run tests/unit/edge-to-edge.spec.js`. The explicit
      `NODE_ENV=test` is required (see step 0). It asserts the pin is exact
     (no caret), that `package-lock.json` resolves the same version, that
     `SystemBars.insetsHandling` is `"disable"`, and that the EdgeToEdge plugin is present
     in the committed Android wiring. If it fails, **stop** - do not hand-verify.

3b. **Physical Android QA** (required before release):
   - Run the **Baseline Regression Suite** in `docs/workflows/qa.md` in full: B1 (status
     bar), B2 (GROUP question keyboard and bottom scroll), B3 (drawer scroll), B7 (DATE
     question picker and value layout) and B8 (TIME question picker and value layout).
     Mandatory on every release, not only when the diff touches insets or the date/time
     questions, because these surfaces share one inset configuration and the native
     date/time pickers have regressed on Android WebView updates before.
   - Add the release-specific checks on top: modal and camera-preview geometry.
   - iOS: sanity open (no crash).
   - Record results in `docs/QA-<version>.md`.

4. Apply edits (exact string replacement, preserve indentation)
   - `package.json`: `"version": "<new>"`
   - `package-lock.json`: `"version": "<new>"` in both version fields (root and
     `packages[""]`). npm does not sync these on a hand-edit of `package.json`,
     so bump them explicitly — never `npm install` for this (it rewrites pins
     and may churn unrelated entries; see 3a).
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
   - `NODE_ENV=test npx vitest run tests/unit/changelog.spec.js` (enforces heading format,
     uniqueness, and that the package version has notes).
   - `NODE_ENV=test npx vitest run tests/unit/edge-to-edge.spec.js` (re-asserts the pin and the native
     wiring after the version bump has touched `package.json`).

7. Report and confirm follow-up
   - Show version, build, and changed files.
   - Ask whether to commit (`chore: release <new> (build <build>)`) and create an
     annotated tag (`<new>`, e.g. `98.2.9`, matching the repo's `X.Y.Z` tag
     history). Do not commit or tag unless confirmed.
   - The tag must be pushed to origin: the push is what makes
     `.github/workflows/releases.yml` create the GitHub Release (with the changelog
     notes) that step 8 attaches the APK to.

8. Build, verify and attach the APK  (after the tag is pushed and the Release exists)

   a. Build the production bundle — it MUST come from `native:prod`:

        npm run native:prod      # VITE_MODE=WEBVIEW VITE_DEBUG= VITE_BYPASS_UNIQUENESS= vite build + cap copy
        npx cap open android     # open Android Studio (does not rebuild)

      Do NOT use `npm run android:open` or `npm run android:build`: they do not clear
      `VITE_DEBUG` / `VITE_BYPASS_UNIQUENESS`, so a dev `.env.local` (`VITE_DEBUG=1`)
      ships debug helpers and a non-production server URL.
      If Gradle complains that `android/capacitor-cordova-android-plugins/` is missing,
      run `npx cap sync android` (that dir is gitignored; `cap copy` does not create it).

   b. Gate the bundle — never proceed on failure:

        node scripts/check-release-bundle.js

      It fails when the packaged assets are not a `native:prod` build. Fix by rebuilding
      with `npm run native:prod`.

   c. Sign in Android Studio: Build -> Generate Signed Bundle / APK -> APK (release)
      with the release keystore, saving to `android/app/release/<build>.apk`
      (e.g. `9856.apk`). Rename `app-release.apk` to `<build>.apk` if needed.

   d. Gate the signed APK itself — this is the check that stops an APK built from a
      `npm run native:debug` (or `android:open`) copy from being uploaded — then check
      the signature:

        node scripts/check-release-bundle.js android/app/release/<build>.apk
        apksigner verify --print-certs android/app/release/<build>.apk

      Never upload when the gate fails: rebuild with `npm run native:prod`, re-sign and
      re-gate.

   e. Wait for the Release created by `.github/workflows/releases.yml` (retry until it
      exists):

        gh release view <tag>

   f. With the user's confirmation, upload the APK onto the Release:

        gh release upload <tag> android/app/release/<build>.apk --clobber

   g. Verify the asset is attached:

        gh release view <tag> --json assets

## Constraints (AGENTS.md)

- Do NOT introduce TypeScript or new patterns.
- Follow existing architecture/conventions.
- System risk check: Android `versionCode` and iOS `CURRENT_PROJECT_VERSION` must
  stay equal to the same build number; a mismatch breaks store uploads.
- The release bundle MUST be built with `npm run native:prod`; `native:debug`,
  `android:open` and `android:build` leave the debug flags at the dev `.env.local` value
  and would ship debug helpers. `scripts/check-release-bundle.js` guards this — run it
  against the signed APK before uploading.
