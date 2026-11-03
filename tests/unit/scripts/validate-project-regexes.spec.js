import { describe, expect, it, vi } from 'vitest';
// scripts/ is outside src/, so the `@` alias does not reach it.
import {
    createCompiler,
    parseCsv,
    patternRows,
    summarise,
    toCsv,
    toRecords,
    validateRecords
} from '../../../scripts/validate-project-regexes.js';

const HEADER = 'project_ref,project_slug,input_ref,input_type,input_name,regex,structure_last_updated';

// ^a{1,2}$ contains a comma and ^["]$ a quote: the two things an export gets wrong
const record = (overrides = {}) => ({
    project_ref: 'water12',
    project_slug: 'water-quality',
    input_ref: 'input_1',
    input_type: 'text',
    input_name: 'How many?',
    regex: '^[0-9]{3}$',
    structure_last_updated: '2026-09-14',
    ...overrides
});

describe('parseCsv()', () => {
    it('reads plain rows and drops the trailing empty line', () => {
        expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
    });

    it('handles CRLF line endings and a UTF-8 BOM', () => {
        expect(parseCsv('\uFEFFa,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    });

    it('keeps commas inside quoted fields', () => {
        expect(parseCsv(HEADER + '\n"water12","water-quality","input_1","text","How, many?","^a{1,2}$","2026-09-14"\n')[1][4]).toBe('How, many?');
        expect(parseCsv(HEADER + '\n"water12","water-quality","input_1","text","How, many?","^a{1,2}$","2026-09-14"\n')[1][5]).toBe('^a{1,2}$');
    });

    it('unescapes doubled quotes without touching backslashes', () => {
        //CSV for the pattern ^"\\d$ : the inner quote is doubled, the backslash is not
        const [, row] = parseCsv(HEADER + '\n"p","s","i","text","Say ""hi""","^""\\d$","2026-09-14"\n');

        expect(row[4]).toBe('Say "hi"');
        expect(row[5]).toBe('^"\\d$');
    });

    it('keeps newlines that sit inside a quoted field', () => {
        const [, row] = parseCsv(HEADER + '\n"p","s","i","text","line1\nline2","^x$","2026-09-14"\n');
        expect(row[4]).toBe('line1\nline2');
        expect(row[5]).toBe('^x$');
    });
    it('rejects a quote inside an unquoted field instead of swallowing it', () => {
        expect(() => parseCsv('a,b\nab"cd,e')).toThrow(/quote inside an unquoted field/);
    });

    it('rejects content after the closing quote of a field', () => {
        expect(() => parseCsv('a,b\n"ab"cd,e')).toThrow(/after the closing quote/);
    });

    it('rejects input that ends inside a quoted field', () => {
        expect(() => parseCsv('a,b\n"never closed,e')).toThrow(/ends inside a quoted field/);
    });
});

describe('toRecords()', () => {
    it('maps columns by header name', () => {
        const [first] = toRecords(HEADER + '\n"water12","water-quality","input_1","text","How many?","^[0-9]{3}+$","2026-09-14"\n');

        expect(first).toEqual({
            project_ref: 'water12',
            project_slug: 'water-quality',
            input_ref: 'input_1',
            input_type: 'text',
            input_name: 'How many?',
            regex: '^[0-9]{3}+$',
            structure_last_updated: '2026-09-14'
        });
    });

    it('ignores extra columns the export carries', () => {
        const [first] = toRecords('regex,extra\n^a$,ignored\n');

        expect(first.regex).toBe('^a$');
    });

    it('rejects a header whose normalized column names repeat', () => {
        expect(() => toRecords('regex, Regex\n^a$,^b$')).toThrow(/duplicate column "regex"/);
    });

    it('rejects an export without a regex column', () => {
        expect(() => toRecords('project_ref,question\nwater12,How many?\n')).toThrow(/missing "regex" column/);
    });

    it('rejects a row shorter than the header instead of dropping its pattern', () => {
        //cut off before the regex column: padding it with '' would audit nothing
        const truncated = HEADER + '\nwater12,water-quality,input_1,text,How many?\n';

        expect(() => toRecords(truncated)).toThrow(/the export is truncated/);
    });

    it('rejects a mis-quoted row instead of reporting a truncated pattern', () => {
        //the field was written unquoted, so the comma split it into two
        const broken = HEADER + '\nwater12,water-quality,input_1,text,How many,^a{1,2}$,2026-09-14\n';

        expect(() => toRecords(broken)).toThrow(/not RFC 4180 quoted/);
    });

    it('rejects an empty file', () => {
        expect(() => toRecords('')).toThrow(/empty/);
    });
});

describe('patternRows()', () => {
    it('skips only truly empty patterns and never trims one', () => {
        const rows = patternRows([
            record({ regex: '' }),
            record({ regex: ' ' }),
            record({ regex: '^[0-9]{3}+$' })
        ]);

        expect(rows.map((row) => row.regex)).toEqual([' ', '^[0-9]{3}+$']);
    });
});

describe('validateRecords()', () => {
    const compile = (pattern) => {
        if (pattern === '(') {
            return { status: 'compile-error', message: 'missing closing parenthesis' };
        }
        return { status: 'ok', message: '' };
    };

    it('compiles each distinct pattern once across every row that uses it', async () => {
        const spy = vi.fn(compile);
        const results = await validateRecords([
            record({ regex: '^[0-9]{3}$' }),
            record({ regex: '^[0-9]{3}$', input_ref: 'input_2' }),
            record({ regex: '^[0-9]{2}$', input_ref: 'input_3' })
        ], spy);

        expect(spy).toHaveBeenCalledTimes(2);
        expect(results).toHaveLength(3);
        expect(results[1]).toMatchObject({ input_ref: 'input_2', status: 'ok' });
    });

    it('carries the verdict onto the identifying columns', async () => {
        const [result] = await validateRecords([record({ regex: '(' })], compile);

        expect(result).toEqual({
            project_ref: 'water12',
            project_slug: 'water-quality',
            input_ref: 'input_1',
            input_type: 'text',
            input_name: 'How many?',
            regex: '(',
            status: 'compile-error',
            message: 'missing closing parenthesis'
        });
    });

    it('honours the sampling limit on distinct patterns', async () => {
        const results = await validateRecords([
            record({ regex: '^[0-9]{3}$' }),
            record({ regex: '^[0-9]{2}$', input_ref: 'input_2' })
        ], compile, { limit: 1 });

        expect(results.map((result) => result.regex)).toEqual(['^[0-9]{3}$']);
    });
});

describe('summarise()', () => {
    it('counts per status and orders projects by failures', () => {
        const summary = summarise([
            { ...record(), status: 'ok' },
            { ...record({ project_ref: 'p2' }), status: 'compile-error' },
            { ...record({ project_ref: 'p2' }), status: 'ok' }
        ]);

        expect(summary.counts).toEqual({ ok: 2, 'compile-error': 1, 'engine-error': 0 });
        expect(summary.projects).toEqual([
            { project: 'p2', total: 2, failed: 1 },
            { project: 'water12', total: 1, failed: 0 }
        ]);
    });

    it('groups rows without a project identifier together', () => {
        const summary = summarise([{ ...record({ project_ref: '', project_slug: '' }), status: 'ok' }]);

        expect(summary.projects[0].project).toBe('(unknown project)');
    });
});

describe('toCsv()', () => {
    it('round-trips patterns containing commas, quotes and newlines', () => {
        const entries = [
            { ...record({ regex: '^a{1,2}$' }), status: 'ok', message: '' },
            { ...record({ regex: '^["\']$', input_ref: 'input_2' }), status: 'compile-error', message: 'line1\nline2' }
        ];

        const rows = parseCsv(toCsv(entries));

        expect(rows[0]).toEqual(['project_ref', 'project_slug', 'input_ref', 'input_type', 'input_name', 'regex', 'status', 'message']);
        expect(rows[1][5]).toBe('^a{1,2}$');
        expect(rows[2][5]).toBe('^["\']$');
        expect(rows[2][7]).toBe('line1\nline2');
    });
});

describe('createCompiler()', () => {
    it('uses the app engine, so PCRE-only syntax passes and broken patterns fail', async () => {
        const compile = await createCompiler();

        //valid in PHP/PCRE, SyntaxError in JavaScript: the client accepts it
        expect(compile('^[0-9]{3}+$').status).toBe('ok');
        expect(compile('^\\Aabc\\z$').status).toBe('ok');

        const broken = compile('(');
        expect(broken.status).toBe('compile-error');
        expect(broken.message).toEqual(expect.any(String));
    });
});
