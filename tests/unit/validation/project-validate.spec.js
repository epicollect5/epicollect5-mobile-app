import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { projectValidate } from '@/services/validation/project-validate';
import { notificationService } from '@/services/notification-service';
import { rollbarService } from '@/services/utilities/rollbar-service';
import { useRootStore } from '@/stores/root-store';
import {
    PHP_ONLY_REGEX_PATTERNS,
    JS_VALID_REGEX_PATTERNS,
    PCRE_ONLY_ESCAPE_PATTERNS,
    MALFORMED_REGEX_PATTERNS
} from '@/helpers/php-only-regex-patterns';

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showDismissAlert: vi.fn()
    }
}));

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: {
        criticalWithContext: vi.fn()
    }
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
            status_codes: {
                ec5_392: 'The regular expression is invalid or malformed.'
            }
        }
    }
}));

const docsUrl = 'https://docs.epicollect.net/formbuilder/add-inputs#regex';

function projectWithPattern (pattern) {
    return {
        inputs: {
            input_1: {
                data: {
                    ref: 'input_1',
                    question: 'Code?',
                    regex: pattern
                }
            }
        }
    };
}

describe('projectValidate.findInvalidRegexes()', () => {

    it('premise: the PCRE-only patterns throw in JavaScript', () => {
        PHP_ONLY_REGEX_PATTERNS.forEach(({ pattern }) => {
            expect(() => new RegExp(pattern)).toThrow(SyntaxError);
        });
    });

    it('premise: the malformed patterns throw in JavaScript too', () => {
        MALFORMED_REGEX_PATTERNS.forEach(({ pattern }) => {
            expect(() => new RegExp(pattern)).toThrow(SyntaxError);
        });
    });

    it.each(PHP_ONLY_REGEX_PATTERNS)('accepts the $description', async ({ pattern }) => {
        //valid in PHP/PCRE: the app must not reject the project for it
        await expect(projectValidate.findInvalidRegexes(projectWithPattern(pattern))).resolves.toEqual([]);
    });

    it.each(JS_VALID_REGEX_PATTERNS)('accepts the $description', async ({ pattern }) => {
        await expect(projectValidate.findInvalidRegexes(projectWithPattern(pattern))).resolves.toEqual([]);
    });

    it.each(PCRE_ONLY_ESCAPE_PATTERNS)('accepts the $description with PCRE2', async ({ pattern }) => {
        //JavaScript compiles these with a different meaning: only PCRE2 may judge them
        await expect(projectValidate.findInvalidRegexes(projectWithPattern(pattern))).resolves.toEqual([]);
    });

    it.each(MALFORMED_REGEX_PATTERNS)('flags the $description', async ({ pattern }) => {
        await expect(projectValidate.findInvalidRegexes(projectWithPattern(pattern))).resolves.toEqual([
            {
                ref: 'input_1',
                question: 'Code?',
                regex: pattern,
                message: expect.any(String)
            }
        ]);
    });

    it('ignores empty, null and missing patterns', async () => {
        const projectExtra = {
            inputs: {
                null_regex: { data: { ref: 'null_regex', question: 'A', regex: null } },
                empty_regex: { data: { ref: 'empty_regex', question: 'B', regex: '' } },
                valid_regex: { data: { ref: 'valid_regex', question: 'C', regex: '^[0-9]{3}$' } }
            }
        };

        await expect(projectValidate.findInvalidRegexes(projectExtra)).resolves.toEqual([]);
    });

    it('returns an empty list when the project has no inputs', async () => {
        await expect(projectValidate.findInvalidRegexes({})).resolves.toEqual([]);
        await expect(projectValidate.findInvalidRegexes(undefined)).resolves.toEqual([]);
        await expect(projectValidate.findInvalidRegexes({ inputs: {} })).resolves.toEqual([]);
    });

    it('reports only the malformed patterns of a mixed project', async () => {
        const projectExtra = {
            inputs: {
                possessive: { data: { ref: 'possessive', question: 'Possessive', regex: '^[0-9]{3}+$' } },
                recursion: { data: { ref: 'recursion', question: 'Recursion', regex: '\\((?:[^()]|(?R))*\\)' } },
                malformed: { data: { ref: 'malformed', question: 'Malformed', regex: '(' } }
            }
        };

        const invalidRegexes = await projectValidate.findInvalidRegexes(projectExtra);

        expect(invalidRegexes.map((invalidRegex) => invalidRegex.ref)).toEqual(['malformed']);
    });
});

describe('projectValidate.showInvalidRegexAlert()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = 'en';
        vi.clearAllMocks();
    });

    it('shows the standard error alert with the docs link and OK', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const project = { slug: 'water12', ref: 'water12' };
        const invalidRegexes = [
            {
                ref: 'input_1',
                question: 'How many?',
                regex: '(',
                message: 'PCRE2 compile error at offset 1: missing closing parenthesis'
            }
        ];

        await projectValidate.showInvalidRegexAlert(invalidRegexes, project);

        //reported so the project definition can be found and fixed
        expect(rollbarService.criticalWithContext).toHaveBeenCalledWith(
            'project import: invalid regex pattern',
            { project, invalidRegexes }
        );

        expect(notificationService.showDismissAlert).toHaveBeenCalledWith(
            'The regular expression is invalid or malformed.<br><br>"How many?" (()',
            'Error',
            docsUrl,
            'OK'
        );
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

        consoleWarnSpy.mockRestore();
    });

    it('lists every affected question and escapes project text', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await projectValidate.showInvalidRegexAlert([
            {
                ref: 'input_1',
                question: 'How many?',
                regex: '(',
                message: 'PCRE2 compile error'
            },
            {
                ref: 'input_2',
                question: '<b>Code?</b>',
                regex: '[a-',
                message: 'PCRE2 compile error'
            }
        ], { slug: 'water12', ref: 'water12' });

        expect(notificationService.showDismissAlert).toHaveBeenCalledWith(
            'The regular expression is invalid or malformed.'
            + '<br><br>"How many?" (()'
            + '<br>"&lt;b&gt;Code?&lt;/b&gt;" ([a-)',
            'Error',
            docsUrl,
            'OK'
        );
        expect(consoleWarnSpy).toHaveBeenCalledTimes(2);

        consoleWarnSpy.mockRestore();
    });
});
