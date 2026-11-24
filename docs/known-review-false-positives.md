# Known Review False Positives

Findings that look like defects but are by design. The review workflow (`docs/workflows/review.md`) instructs reviewers to read this file and drop any candidate that matches an entry. Keep this list current: when a design changes, update or remove the affected entries so stale entries do not mask real regressions.

- **Partially downloaded entries are not wiped when a download aborts on a mid-download project version change** (`src/services/entries-download-service.js`, `error?.versionChanged` branch)

  Reported as: "the abort clears progress but leaves already-inserted entries with a mismatched structure and no cleanup; on restart they are corrupt."

  Why it is by design: the rows match the still-old local structure until `updateProject()` runs, so nothing is corrupt at abort time. Restart is forced from the first form only (`resetDownloadButtonState`), and `deleteEntriesBeforeDownload()` wipes all remote entries (with media and unique answers) for every form before re-downloading, so no old-structure rows survive an update plus restart. The version check also runs before each page fetch, so new-structure data is never inserted. See the Native Download section of `docs/ARCHITECTURE.md` for the full invariant.

- **Foreground cycle inside an in-flight camera restart can leave a paused session with no deferred recovery** (`src/components/modals/ModalCameraPreview.vue`, `restartInProgress` branch)

  Reported as: "foregrounding while _recoverFeed() has restartInProgress returns without setting that flag, so the in-flight restart can still complete with a paused camera session and no subsequent recovery."

  Why it is accepted as-is: triggering it needs a background/foreground/background/foreground sequence with the middle pair landing inside the restart's sub-second start window plus the OS pausing the plugin mid-start; the only effect is a frozen feed with no data at risk, cleared by closing and reopening the camera (the close path never depends on session liveness). Serializing overlapping recoveries was judged more complex than the finding warrants.

- **Queued media-row deletion removes sibling entries' rows sharing a filename** (`src/services/database/database-delete-service.js`, `deleteMediaFiles` branch)

  Reported as: "the queued-media query still deletes every row in a project sharing a queued filename, so prior-4 remains unresolved where filenames are not project-wide unique."

  Why it is by design: project scoping is intentional (commit `3ae1963` — queued deletions span hierarchy and deferred branch items and execute at hierarchy save, where entry scoping would miss branch rows), and the uniqueness condition holds by construction: every name is generated as `{entryUuid}_{timestamp}.{ext}` with the owning entry's uuid (all generation call sites), the single `INSERT INTO media` site is fed only by `insertMedia`, and no server-named rows ever enter the table. Cross-entry collision is therefore impossible, and sub-second double generation within one entry is physically impossible on device.

- **Handoff escape reopens the exit while a payload handoff is still pending** (`src/components/modals/ModalCameraPreview.vue`, `_claimHandoff` escape branch)

  Reported as: "after the three-second escape it clears the guard while the payload handoff is still pending, allowing an empty dismissal to win and leave the completed capture undelivered."

  Why it is accepted as-is: the escape only fires after a 3s stalled native stop (abnormal — the normal handoff is milliseconds), and the alternative is a permanently unclosable modal on a hung stop. The fallback is exactly today's pre-fix behaviour (empty dismiss + possible cache orphan), and the stall is reported to Rollbar as `CameraPreview handoff stalled` so genuine hangs are visible.

- **Bookmark refresh skips the project version check** (`src/pages/Entries.vue`, `getEntriesPageContent skipProjectVersionCheck guard`)

  Reported as: "When a bookmark opens on an Entries page that remains mounted, the bookmark handler destroys the project model and this refresh loads it again. Passing `true` skips the version check even on that cold load, so an outdated bookmarked project can display entries without an update prompt."

  Why it is by design: bookmark opens intentionally skip the project update prompt because applying an update resets the list to the first form and clears the hierarchy, which would invalidate the saved bookmark destination. Staleness is enforced downstream by uploads, downloads and the server, and the next Projects-page cold open still prompts.

- **Unsynced non-editable (remote) entries are re-synced without an upload, so no project-version prompt fires for them** (`src/services/upload-data-service.js`, `can_edit === 0` skip branch)

  Reported as: "Unsync All Entries then upload fires no outdated-project prompt even on a stale project, so the `ec5_201` guard is being skipped for updates."

  Why it is by design: every entry that is actually written is version-checked server-side (`EntriesUploadService::isProjectVersionValid()`, called before the create/update fork, unconditional in all branches). A non-editable entry is never sent — there is nothing the user may change — so it is skipped and only re-marked synced locally once its branches finish. The guard therefore covers all real writes; what looks like a bypass is an entry that was never in scope. `database-update-service.unsyncAllEntries()` has no `can_edit` filter and unsyncs every row with `synced < INCOMPLETE`, which is what puts these rows into the pending set in the first place. See the Native Upload section of `docs/ARCHITECTURE.md`.

- **The PCRE2 no-engine path being unreachable on supported devices is by design, not an unhandled degradation** (`src/services/validation/regex-service.js`, `isAvailable()` branch)

  Reported as: "the app can run without the regex engine, so project patterns are silently not enforced on old WebViews; reject those projects or keep a JavaScript fallback."

  Why it is by design: the supported matrix is Android 10 (`minSdkVersion = 29`) and iOS 16, whose WebViews all support WebAssembly (Chromium 57+, Safari 11+), and Android's WebView updates through Play Store. Any capability the matrix provides must be assumed present: a failure is a defect (memory pressure, a policy or CSP forbidding WebAssembly compilation, an upstream engine defect), not a device class, and it is reported to Rollbar as `regex: PCRE2 engine init failed`. Answers are deliberately left unchecked in that state rather than judged by JavaScript, because JavaScript reads PCRE-only patterns differently — the failure mode that made project `30686` unable to save any answer. Import validation has no JavaScript path either: a definition with any pattern is refused as unverifiable while the engine cannot load, so every definition imported by this build is checked before it is used. The answer-time skip is not limited to definitions no build ever validated: when the engine fails to initialise on a later launch, the check is skipped for every loaded definition, including one this build imported successfully, because nothing distinguishes them at that point and nothing re-validates a project on load (a project update does, which is how stale definitions get retired). See *Supported Platforms* and *Answer Regex Evaluation* in `docs/ARCHITECTURE.md`.

- **The picker-icon attribute comparison in DateTimeField.spec.js is meaningful, not a serialized-object mismatch** (`tests/unit/components/DateTimeField.spec.js`, picker icon attribute comparison)

  Reported as: "This compares serialized attributes on plain custom elements, so both SVG icon objects stringify identically and the assertion fails instead of verifying the icons differ. Compare the component's `pickerIcon` values or stub `ion-icon` and inspect its prop."

  Why it is by design: `ionicons/icons` exports each icon as a full SVG data-URI **string** (`typeof timeOutline === 'string'`, e.g. `data:image/svg+xml;utf8,<svg …>`), not an object. The `:icon` binding therefore renders a distinct `icon` attribute per picker type, so `expect(timeIcon.attributes('icon')).not.toBe(pickerIcon.attributes('icon'))` compares two genuinely different values — it passes today and still fails if both picker types rendered the same icon, which is exactly what it guards.

- **Keyboard focus can reach Exit and Next under the upload wait overlay** (`src/components/globals/WaitOverlay.vue`, `waitOverlayStore.isUploading`)

  Reported as: "the overlay blocks pointer events but not tab focus, so a keyboard user can activate Exit and confirm Quit during an upload; the branch question then unmounts and the app-wide blocker is never dismissed."

  Why it is accepted as-is: the app has no keyboard-driven actions — the only key listeners in `src/` are the two `@keyup` handlers on the latitude and longitude inputs in `src/components/platform/LocationPwa.vue` — and every supported target is a touch surface, so tab focus does not reach the toolbar in normal use. Leaving an entry mid-upload is the user's own choice behind a confirm dialog (`quitEntry()` asks `are_you_sure` first), and it discards unsaved answers by design: a reload clears the overlay with everything else, exactly as abandoning any unsaved form mid-write does. Guarding `quitEntry()` was rejected because it would couple the exit path to upload state for a condition the UI cannot be driven into by touch.

- **CARTO light/dark tiles still load from the old `cartodb-basemaps…fastly.net` host** (`src/config/index.js`, `CARTO_LIGHT_TILES_PROVIDER` / `CARTO_DARK_TILES_PROVIDER`)

  Reported as: "CARTO returns 403 for keyed requests on the old fastly host and has not served keyless raster tiles since 25 September 2026, so both basemap URLs must move to `{s}.basemaps.cartocdn.com` or the light and dark maps render blank."

  Why it is not a defect: checked live on 19 November 2026 — the old host returns 200 for both a keyed and an unkeyed tile, and `a.basemaps.cartocdn.com` returns a byte-identical tile (same md5), so the old host simply ignores the `?key=` parameter instead of rejecting it, and both basemap styles load. The key is sent because CARTO gates raster tiles on a key for newer accounts; if that gate ever reaches the old host the fix is a host swap, and the way to settle this is a live tile request, never a reading of the config.

- **`hasMediaFiles` reads one nesting level too deep and throws** (`src/services/entry/save-entry-pwa.js`, `hasMediaFiles`)

  Reported as: "`entry.media[inputRef]` is `{filenamePWA: {...}}`, so `Object.values(inputMedia)` yields the bucket itself, `mediaFile.filenamePWA` is undefined and `.cached` throws before the progress dialog opens."

  Why it is correct: `entry.media` is keyed uuid → inputRef → `{filenamePWA: {cached, stored}}`. `mediaService.getEntryStoredMediaPWA()` seeds that bucket for every media input of the form, unanswered ones included (`media-service.js:176-200`), and `MediaPwa.vue:82` seeds it too for slots it creates. The two `Object.values` loops therefore walk uuid → inputRef and land on `{filenamePWA}`, whose `cached` is always a string, so the `!== ''` test never sees `undefined`. Branch entries are built by the same function (`branch-entry-service.js:86`).

- **The new branch lists lose the original infinite-scroll event** (`src/components/questions/QuestionBranch.vue`, `loadEntriesChunk`)

  Reported as: "the `branch-pwa`/`branch-native` children re-emit a payload, so the parent's `ev.target.complete()` and `ev.target.disabled` throw."

  Why it is correct: both children pass the original `IonInfiniteScrollCustomEvent` through unchanged — `BranchPwa.vue:198` and `BranchNative.vue:148` are both `context.emit('load-entries-chunk', ev)` — and the parent completes and disables on `ev.target` (`QuestionBranch.vue:376,379`). Nothing re-wraps the payload.

- **Existing media is no longer restored into `answer.answer`** (`src/components/platform/*`, question wrappers)

  Reported as: "QuestionPhoto/QuestionVideo/QuestionAudio now only create the empty media slot, so editing an entry that has media leaves the answer empty: a required-question check fails or the saved entry loses the media reference."

  Why it is correct: the platform components restore at setup — `PhotoNative.vue:135` and `VideoNative.vue:116` (cached wins over stored, as before the split) — and the PWA card restores in `MediaPwa.vue:89-92`. Native never restored from the media slot at setup before the split either: the answer arrives with the entry's persisted answers, and for audio the component only writes it when a recording lands (`AudioNative.vue:299`), with `isFileAvailable` and the popover reading the live media slot rather than the answer.

- **`import.meta.env.VITE_APP_VERSION` is undefined, so PWA reports carry no `code_version`** (`vite.config.js`, `define`)

  Reported as: "`rollbar-service` reads `import.meta.env.VITE_APP_VERSION` for PWA payloads; if nothing defines it, release grouping and source-map matching break for PWA items."

  Why it is correct: `vite.config.js:26-28` defines it for both builds — `'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION)` — so the value present in the bundle is the package version the build was made from.

- **The removed Mapbox/Stamen basemap constants leave dangling consumers** (`src/config/index.js`)

  Reported as: "the Mapbox and Stamen tile and attribution constants were deleted, so a surviving consumer, or a persisted basemap choice, resolves to `undefined` and that basemap renders blank or throws."

  Why it is correct: no consumer was ever written against them. The tile layers are built from the ESRI, OpenTopoMap, CARTO and OSM constants that remain, and a search of `src/` and `tests/` for the removed names finds nothing. There is also no stored basemap selector to migrate: `grep` for `basemap` in `src/` returns only the constant definitions and their comments, so no persisted choice can resolve to a removed constant.

- **Failed deploys remove working files before copying the replacement** (`scripts/deploy-pwa.js`, `deploy()` wipe-then-copy)

  Reported as: "`deploy()` deletes the working deployment before copying its replacement. If copying fails because of permissions, disk space, or an interrupted process, the server has no working bundle or local rollback. The PWA stays offline until someone repairs or repeats the deployment."

  Why it is accepted as-is: this script is run locally by the developer, not in an automated production deployment. If the copy fails, the operator can simply re-run the deploy; the temporary loss of the target contents is an acceptable operational risk in that workflow, so a staged-copy/switch is unnecessary complexity here.