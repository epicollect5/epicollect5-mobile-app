# Prompt: export every project question regex as CSV

Paste everything below this line into the agent that has access to the
production server. It produces the input file for
`scripts/validate-project-regexes.js`.

---

You are working on the EpiCollect5 server (Laravel, PHP, production database).
I need a read-only export of every question regular expression in every
published project, as a CSV file that a Node audit script will consume. The
exact byte sequence of each pattern matters.

## Why

The mobile/PWA client now compiles project patterns with PCRE2 (WASM) at import
and refuses a definition whose pattern the engine cannot compile. I need to know
which definitions already in production would be refused, before users hit them.

## Where the data is

- The project definition is the JSON structure returned as
  `meta.project_extra` by the API. Find the column that stores it on the
  `projects` table (inspect the schema first — do not assume the column name,
  and check whether it is stored as JSON, TEXT, or compressed/encoded, in which
  case decode it).
- Inside that structure, `inputs` is a map keyed by input ref. Each entry looks
  like `{"data": {"ref": "...", "type": "...", "question": "...", "regex": "..."}}`.
  Some inputs are groups/branches and have no `regex` key at all.
- The project version column is the same one the API returns as
  `project_stats.structure_last_updated`.

## Output contract (follow exactly)

One row per input that has a non-empty `regex`, across all projects. Header:

```
project_ref,project_slug,input_ref,input_type,input_name,regex,structure_last_updated
```

- `project_ref` — the project's unique ref (the value in deeplinks and errors).
- `project_slug` — the public slug.
- `input_ref` — `inputs[ref].data.ref` (fall back to the map key if absent).
- `input_type` — `data.type`, verbatim.
- `input_name` — `data.question`, verbatim (may contain commas, quotes, HTML).
- `regex` — the pattern **byte for byte as stored**.
- `structure_last_updated` — the project version value, as stored.

Rules that the audit script depends on, in order of how easily they are broken:

1. **RFC 4180 CSV.** Quote any field containing a comma, a double quote or a
   newline; double an embedded quote as `""`. Never use backslash escaping —
   `\"` is not CSV and will corrupt patterns that contain a quote.
2. **No extra escaping layer.** Do not use `SELECT ... INTO OUTFILE`,
   `mysqldump --tab`, or anything that applies its own `ESCAPED BY`. Those
   double every backslash, so `\d` becomes `\\d` and the audit reports false
   failures. Use PHP `fputcsv` in an artisan command (preferred: it handles
   quoting per RFC 4180 and lets you stream), or on PostgreSQL
   `COPY (...) TO STDOUT WITH (FORMAT csv, HEADER true)`.
3. **No transformation of `regex`.** No `trim()`, no stripping slashes or
   delimiters (patterns are stored without `/.../ ` delimiters — if this schema
   happens to store delimiters or modifiers separately, stop and tell me rather
   than guessing), no HTML entity decoding, no whitespace normalisation, no
   newline replacement.
4. **Empty vs missing.** Rows are emitted only for inputs with a non-empty
   regex. Do not emit `NULL`/`\N` markers: if a regex is empty or absent, the
   row simply does not exist.
5. **Encoding.** UTF-8, no BOM needed (a BOM is tolerated). Preserve non-ASCII
   question text as UTF-8.
6. **Completeness.** No row limit, no pagination cut-off, no `LIMIT`. Stream in
   chunks of projects so memory stays flat; write the file with a stream.
7. **Determinism.** Order by `project_ref`, then `input_ref`.

## Verify before handing it over

Run these and include the numbers with the file:

1. Row count: `wc -l` on the CSV minus the header must equal a SQL count of all
   inputs with a non-empty regex across all projects (write that count query
   against the same project set you exported).
2. Byte-exactness spot check: the project that broke on the client
   (project `30686`) has a possessive quantifier. Confirm its row's `regex`
   field is exactly `^[0-9]{3}+$` — character for character, no doubled
   backslashes, no surrounding quotes left in the value.
3. No accidental escaping: `grep -c '\\\\' export.csv` should only match
   patterns that genuinely contain two consecutive backslashes, not every
   pattern with one.
4. A pattern containing a comma or a quote round-trips: pick one, open it in a
   CSV parser (Python `csv` module is fine) and confirm the parsed value equals
   the value stored in the database.

## Deliverables

- The artisan command (or the SQL) you used, committed-ready, read-only.
- The exported CSV path and its size.
- The four verification results above.
- Anything in the schema that surprised you (compressed structures, patterns
  stored with delimiters/modifiers, projects with no structure at all).

Do not write to the database, do not run migrations, and do not include any
table data other than what the header above describes.
