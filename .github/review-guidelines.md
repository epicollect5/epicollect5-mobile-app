# PR Review Instructions (MANDATORY)

When reviewing code, do NOT only validate correctness.

You MUST identify system risks and side effects:

* Where can data become stale or inconsistent?
* What happens when underlying data changes or is removed?
* What fails on network issues or partial execution?
* What is cached/stored and when does it become invalid?
* What other parts of the system could be affected?

List at least three concrete risks.

Assume this feature has been in production for months and causes inconsistent data. Explain why.
