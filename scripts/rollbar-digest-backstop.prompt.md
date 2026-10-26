# Weekly Rollbar digest — backstop task

This is the extra rule for the Monday 17:00 backstop task. Everything else is
in `scripts/rollbar-digest.prompt.md`, which this task follows exactly once
the check below has passed.

## Check first: did the morning run already post?

Read this chat before doing anything else. If a message whose body starts with
`# Rollbar digest` already covers this week, the 11:00 run worked. Reply with
a single line saying the digest was already posted this morning, and stop
there. Do not produce a second digest and do not repeat the morning one.

If there is no digest for this week, the morning run failed or never started.
Produce one now, exactly as the morning run would have: follow
`scripts/rollbar-digest.prompt.md`.
