# Known Review False Positives

Findings that look like defects but are by design. The review workflow (`docs/workflows/review.md`) instructs reviewers to read this file and drop any candidate that matches an entry. Keep this list current: when a design changes, update or remove the affected entries so stale entries do not mask real regressions.

- **Partially downloaded entries are not wiped when a download aborts on a mid-download project version change** (`src/services/entries-download-service.js`, `error?.versionChanged` branch)

  Reported as: "the abort clears progress but leaves already-inserted entries with a mismatched structure and no cleanup; on restart they are corrupt."

  Why it is by design: the rows match the still-old local structure until `updateProject()` runs, so nothing is corrupt at abort time. Restart is forced from the first form only (`resetDownloadButtonState`), and `deleteEntriesBeforeDownload()` wipes all remote entries (with media and unique answers) for every form before re-downloading, so no old-structure rows survive an update plus restart. The version check also runs before each page fetch, so new-structure data is never inserted. See the Native Download section of `docs/ARCHITECTURE.md` for the full invariant.