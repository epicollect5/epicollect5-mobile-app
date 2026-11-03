// Audits every question regex from a project export against the same PCRE2
// engine, flags and compile-only call the app uses at project import
// (src/services/validation/regex-service.js), so the definitions the client
// would refuse can be found in bulk instead of one Rollbar alert at a time.
//
// Input format is documented in scripts/regex-export.prompt.md: one row per
// question that has a regex, RFC 4180 quoted, patterns byte-exact.
//
// Usage:
//   node scripts/validate-project-regexes.js <export.csv> [options]
//
//     --out <path>          write the full per-row report as CSV
//     --json                print one JSON object per row instead of a summary
//     --project <ref|slug>  audit a single project
//     --limit <n>           compile only the first n distinct patterns (sampling)
//     --help                this text
//
// Exit codes: 0 every pattern compiles, 1 at least one failed, 2 unusable input.
//
// The whole export is held in memory: it is a one-off audit of a few MB, not
// something that runs in the app or in CI on every build.
//
// It speaks plain `node`, so it cannot import src/services/validation/
// regex-service.js (the `@` alias, Rollbar and Capacitor do not resolve here).
// Instead it calls pcre2-wasm directly with the same compile-only call and the
// same FLAGS.UTF that regexService.validatePattern() uses, which is what makes
// its verdicts match the app's import check. If PATTERN_FLAGS ever changes in
// the app, this line must change with it - three lines of duplicated engine
// config in exchange for a script that runs without Vitest.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPORT_COLUMNS = [
    'project_ref',
    'project_slug',
    'input_ref',
    'input_type',
    'input_name',
    'regex',
    'status',
    'message'
];

const EXPECTED_HEADER = REPORT_COLUMNS.slice(0, 6).concat('structure_last_updated').join(',');
const MAX_REPORTED = 40;

const usage = () => [
    'Usage: node scripts/validate-project-regexes.js <export.csv> [options]',
    '',
    '  --out <path>          write the full per-row report as CSV',
    '  --json                print one JSON object per row instead of a summary',
    '  --project <ref|slug>  audit a single project',
    '  --limit <n>           compile only the first n distinct patterns (sampling)',
    '  --help                this text',
    '',
    'CSV header, one row per question that has a regex:',
    '  ' + EXPECTED_HEADER,
    '',
    'Exit codes: 0 every pattern compiles, 1 at least one failed, 2 unusable input.'
].join('\n');

// RFC 4180: quoted fields, "" for an embedded quote, newlines allowed inside
// quotes. A backslash is never an escape, so patterns survive untouched.
export function parseCsv (text) {
    const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let index = 0; index < clean.length; index++) {
        const char = clean[index];
        if (inQuotes) {
            if (char === '"') {
                if (clean[index + 1] === '"') {
                    field += '"';
                    index++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
            continue;
        }
        if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (char !== '\r') {
            field += char;
        }
    }

    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

export function toRecords (text) {
    const rows = parseCsv(text).filter((row) => !(row.length === 1 && row[0] === ''));
    if (rows.length === 0) {
        throw new Error('the export is empty');
    }

    const header = rows[0].map((name) => name.trim().toLowerCase());
    if (!header.includes('regex')) {
        throw new Error('missing "regex" column; expected header: ' + EXPECTED_HEADER);
    }

    return rows.slice(1).map((row, index) => {
        //a mis-quoted pattern containing a comma lands here as extra fields:
        //failing loudly beats reporting a truncated pattern as broken
        if (row.length > header.length) {
            throw new Error(
                'row ' + (index + 2) + ' has ' + row.length + ' fields, the header has ' + header.length
                + ': the export is not RFC 4180 quoted (a field containing a comma or a quote was split)'
            );
        }
        const record = {};
        header.forEach((name, column) => {
            record[name] = row[column] ?? '';
        });
        return record;
    });
}

//only truly empty cells are skipped: a pattern is never trimmed or altered
export function patternRows (records) {
    return records.filter((record) => record.regex !== '');
}

//compile-only, exactly like projectValidate.findInvalidRegexes(): no subject,
//so this answers "would the app refuse this project at import?"
export async function createCompiler () {
    const { createPCRE2, FLAGS, PCRE2CompileError } = await import('pcre2-wasm');
    const engine = await createPCRE2();

    return (pattern) => {
        try {
            engine.patternInfo(pattern, FLAGS.UTF);
            return { status: 'ok', message: '' };
        } catch (error) {
            return {
                status: error instanceof PCRE2CompileError ? 'compile-error' : 'engine-error',
                message: error.message
            };
        }
    };
}

//identical patterns are compiled once: a dump of thousands of rows has far
//fewer distinct patterns, and compiling is the slow part
export async function validateRecords (records, compile, { limit = Infinity } = {}) {
    const patterns = [...new Set(records.map((record) => record.regex))].slice(0, limit);
    const verdicts = new Map();

    for (const pattern of patterns) {
        verdicts.set(pattern, await compile(pattern));
    }

    return records
        .filter((record) => verdicts.has(record.regex))
        .map((record) => {
            const verdict = verdicts.get(record.regex);
            return {
                project_ref: record.project_ref,
                project_slug: record.project_slug,
                input_ref: record.input_ref,
                input_type: record.input_type,
                input_name: record.input_name,
                regex: record.regex,
                status: verdict.status,
                message: verdict.message
            };
        });
}

export function summarise (results) {
    const counts = {
        ok: 0,
        'compile-error': 0,
        'engine-error': 0
    };
    const projects = new Map();

    results.forEach((result) => {
        counts[result.status] = (counts[result.status] ?? 0) + 1;
        const key = result.project_ref || result.project_slug || '(unknown project)';
        const project = projects.get(key) ?? { project: key, total: 0, failed: 0 };
        project.total++;
        if (result.status !== 'ok') {
            project.failed++;
        }
        projects.set(key, project);
    });

    return {
        counts,
        projects: [...projects.values()].sort((a, b) => (b.failed - a.failed) || a.project.localeCompare(b.project))
    };
}

const escapeField = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

export function toCsv (results) {
    const lines = [REPORT_COLUMNS.join(',')];
    results.forEach((result) => {
        lines.push(REPORT_COLUMNS.map((column) => escapeField(result[column])).join(','));
    });
    return lines.join('\n') + '\n';
}

//patterns can contain control characters: keep one finding on one line
const display = (value) => String(value ?? '')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');

export async function main (argv = process.argv.slice(2)) {
    const options = {
        json: false,
        out: null,
        project: null,
        limit: Infinity,
        help: false
    };
    const positional = [];

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--json') {
            options.json = true;
        } else if (arg === '--out') {
            options.out = argv[++index];
            if (!options.out) {
                throw new Error('--out expects a path');
            }
        } else if (arg === '--project') {
            options.project = argv[++index];
            if (!options.project) {
                throw new Error('--project expects a project ref or slug');
            }
        } else if (arg === '--limit') {
            const limit = Number(argv[++index]);
            if (!Number.isInteger(limit) || limit < 1) {
                throw new Error('--limit expects a positive integer');
            }
            options.limit = limit;
        } else if (arg.startsWith('--')) {
            throw new Error('unknown option ' + arg);
        } else {
            positional.push(arg);
        }
    }

    if (options.help || positional.length === 0) {
        console.log(usage());
        return 0;
    }

    const records = toRecords(readFileSync(positional[0], 'utf8'));
    const scoped = options.project
        ? records.filter((record) => record.project_ref === options.project || record.project_slug === options.project)
        : records;
    const rows = patternRows(scoped);

    if (rows.length === 0) {
        console.log(options.project ? 'no patterns found for project ' + options.project : 'no patterns found in the export');
        return 0;
    }

    const distinct = new Set(rows.map((record) => record.regex)).size;
    const results = await validateRecords(rows, await createCompiler(), { limit: options.limit });
    const summary = summarise(results);
    const failed = summary.counts['compile-error'] + summary.counts['engine-error'];

    if (options.out) {
        writeFileSync(options.out, toCsv(results));
    }

    if (options.json) {
        results.forEach((result) => console.log(JSON.stringify(result)));
    } else {
        console.log(
            'validate-project-regexes: ' + results.length + ' rows, ' + distinct + ' distinct patterns'
            + ' (PCRE2 compile-only, FLAGS.UTF - the app\'s import check)'
        );
        console.log('  ok:            ' + summary.counts.ok);
        console.log('  compile-error: ' + summary.counts['compile-error']);
        console.log('  engine-error:  ' + summary.counts['engine-error']);

        if (failed > 0) {
            const affected = summary.projects.filter((project) => project.failed > 0);
            console.log('');
            console.log('affected projects: ' + affected.length);
            affected.forEach((project) => {
                console.log('  ' + project.project + '  ' + project.failed + '/' + project.total);
            });

            const failures = results.filter((result) => result.status !== 'ok');
            console.log('');
            console.log('failing patterns:');
            failures.slice(0, MAX_REPORTED).forEach((result) => {
                console.log(
                    '  ' + (result.project_ref || result.project_slug || '(unknown)')
                    + ' ' + result.input_ref
                    + ' "' + display(result.input_name) + '"'
                    + ' ' + display(result.regex)
                    + ' -> ' + result.status + ': ' + display(result.message)
                );
            });
            if (failures.length > MAX_REPORTED) {
                console.log('  ... ' + (failures.length - MAX_REPORTED) + ' more, use --out for the full report');
            }
        }
    }

    if (options.out) {
        console.log('');
        console.log('report written to ' + options.out);
    }

    return failed > 0 ? 1 : 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    main()
        .then((code) => {
            process.exitCode = code;
        })
        .catch((error) => {
            console.error('validate-project-regexes: ' + error.message);
            process.exitCode = 2;
        });
}
