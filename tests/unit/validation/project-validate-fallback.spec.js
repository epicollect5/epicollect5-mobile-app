import { vi, describe, it, expect } from 'vitest';
import { projectValidate } from '@/services/validation/project-validate';
import {
    PHP_ONLY_REGEX_PATTERNS,
    JS_VALID_REGEX_PATTERNS,
    PCRE_ONLY_ESCAPE_PATTERNS,
    MALFORMED_REGEX_PATTERNS
} from '@/helpers/php-only-regex-patterns';

//unsupported WebView / blocked WASM: the service reports itself unavailable,
//the real usesPcreOnlySyntax() is what the fallback is being tested for
vi.mock('@/services/validation/regex-service', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        regexService: {
            ...actual.regexService,
            isAvailable: vi.fn().mockResolvedValue(false)
        }
    };
});

vi.mock('@/services/notification-service', () => ({
    notificationService: { showDismissAlert: vi.fn() }
}));

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: { criticalWithContext: vi.fn() }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        PROJECT_REGEX_DOCS_URL: 'https://docs.epicollect.net/formbuilder/add-inputs#regex'
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: { error: 'Error', ok: 'OK' },
            status_codes: { ec5_392: 'The regular expression is invalid or malformed.' }
        }
    }
}));

const CANNOT_COMPILE = 'JavaScript cannot compile this pattern';
const DIFFERENT_MEANING = 'PCRE-only syntax JavaScript would read differently';

function projectWithPattern (pattern) {
    return {
        inputs: {
            input_1: { data: { ref: 'input_1', question: 'Code?', regex: pattern } }
        }
    };
}

describe('projectValidate.findInvalidRegexes() without PCRE2', () => {

    it('premise: the PCRE-only escapes compile in JavaScript but mean something else', () => {
        PCRE_ONLY_ESCAPE_PATTERNS.forEach(({ pattern }) => {
            expect(() => new RegExp(pattern)).not.toThrow();
        });
    });

    it.each(PHP_ONLY_REGEX_PATTERNS)('rejects the $description JavaScript cannot compile', async ({ pattern }) => {
        await expect(projectValidate.findInvalidRegexes(projectWithPattern(pattern))).resolves.toEqual([
            {
                ref: 'input_1',
                question: 'Code?',
                regex: pattern,
                message: CANNOT_COMPILE
            }
        ]);
    });

    it.each(MALFORMED_REGEX_PATTERNS)('rejects the $description', async ({ pattern }) => {
        await expect(projectValidate.findInvalidRegexes(projectWithPattern(pattern))).resolves.toEqual([
            {
                ref: 'input_1',
                question: 'Code?',
                regex: pattern,
                message: CANNOT_COMPILE
            }
        ]);
    });

    it.each(PCRE_ONLY_ESCAPE_PATTERNS)('rejects the $description instead of enforcing it elsewhere', async ({ pattern }) => {
        //accepting it would enforce the JavaScript reading of the pattern
        await expect(projectValidate.findInvalidRegexes(projectWithPattern(pattern))).resolves.toEqual([
            {
                ref: 'input_1',
                question: 'Code?',
                regex: pattern,
                message: DIFFERENT_MEANING
            }
        ]);
    });

    it.each(JS_VALID_REGEX_PATTERNS)('still accepts the $description', async ({ pattern }) => {
        await expect(projectValidate.findInvalidRegexes(projectWithPattern(pattern))).resolves.toEqual([]);
    });
});
