---
name: false-positive
description: Mark a review finding as false positive — comment code and record in known-review-false-positives.md
---

# False Positive

Mark a review finding as a false positive.

Follow the **False Positive Workflow** defined in `docs/workflows/false-positive.md`.

Forward `$ARGUMENTS` verbatim to the workflow. If `$ARGUMENTS` is empty, derive the target (file, condition, reported text, and reason) from the session context — the most recent review report in the conversation — and ask the user for any missing `reason` or to disambiguate between multiple findings. Do not assume a finding without confirmation.
