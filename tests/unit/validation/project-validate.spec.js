import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { projectValidate } from '@/services/validation/project-validate';
import { regexService, RegexEngineUnavailableError } from '@/services/validation/regex-service';
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
            labels: {
                error: 'Error',
                ok: 'OK',
                regex_unverifiable: 'This project cannot be added because its regular expressions could not be checked on this device. Please retry, or try another device.',
                regex_unverifiable_update: 'This project cannot be updated because its regular expressions could not be checked on this device. Please retry, or try another device.',
                regex_unverifiable_open: 'This project cannot be opened because its regular expressions could not be checked on this device. Please retry, or try another device.'
            },
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

//a failed expectation must not leak a spy into the next test
beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

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
                message: expect.any(String),
                reason: null
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

    it('does not touch the PCRE2 engine when no question has a regex', async () => {
        //loading the WASM engine costs far more than the check itself
        const validatePatternSpy = vi.spyOn(regexService, 'validatePattern');

        await projectValidate.findInvalidRegexes({
            inputs: {
                text: { data: { ref: 'text', question: 'Name', regex: null } },
                empty: { data: { ref: 'empty', question: 'Code', regex: '' } }
            }
        });

        expect(validatePatternSpy).not.toHaveBeenCalled();

        validatePatternSpy.mockRestore();
    });

    it('reports every pattern as unverifiable when the engine cannot be loaded', async () => {
        const validatePatternSpy = vi.spyOn(regexService, 'validatePattern')
            .mockRejectedValue(new RegexEngineUnavailableError(new Error('WASM module failed to instantiate')));

        //a PCRE-only pattern and one JavaScript could compile: neither may be
        //judged by JavaScript, so the whole definition is refused as unverified
        const projectExtra = {
            inputs: {
                pcre_only: { data: { ref: 'pcre_only', question: 'Possessive', regex: '^[0-9]{3}+$' } },
                js_plain: { data: { ref: 'js_plain', question: 'Plain', regex: '^[0-9]{3}$' } }
            }
        };

        const invalidRegexes = await projectValidate.findInvalidRegexes(projectExtra);

        expect(invalidRegexes).toEqual([
            {
                ref: 'pcre_only',
                question: 'Possessive',
                regex: '^[0-9]{3}+$',
                //the cause travels in the payload reported to Rollbar
                message: 'PCRE2 engine could not verify this pattern: WASM module failed to instantiate',
                reason: 'engine-unavailable'
            },
            {
                ref: 'js_plain',
                question: 'Plain',
                regex: '^[0-9]{3}$',
                //the cause travels in the payload reported to Rollbar
                message: 'PCRE2 engine could not verify this pattern: WASM module failed to instantiate',
                reason: 'engine-unavailable'
            }
        ]);

        validatePatternSpy.mockRestore();
    });

    it('skips a null input record and still validates the rest', async () => {
        const projectExtra = {
            inputs: {
                broken_record: null,
                malformed: { data: { ref: 'malformed', question: 'Malformed', regex: '(' } }
            }
        };

        const invalidRegexes = await projectValidate.findInvalidRegexes(projectExtra);

        expect(invalidRegexes.map((invalidRegex) => invalidRegex.ref)).toEqual(['malformed']);
    });

    it('does not blame the device for an unexpected inspection failure', async () => {
        //only a failure to load the engine is a device-side failure
        const validatePatternSpy = vi.spyOn(regexService, 'validatePattern')
            .mockRejectedValue(new Error('unexpected inspection failure'));

        const invalidRegexes = await projectValidate.findInvalidRegexes(projectWithPattern('^[0-9]{3}$'));

        expect(invalidRegexes).toEqual([
            {
                ref: 'input_1',
                question: 'Code?',
                regex: '^[0-9]{3}$',
                message: 'unexpected inspection failure',
                reason: null
            }
        ]);

        validatePatternSpy.mockRestore();
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
                message: 'PCRE2 compile error at offset 1: missing closing parenthesis',
                reason: null
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

    it('blames the device, not the project, when the engine was unavailable', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const project = { slug: 'water12', ref: 'water12' };
        const invalidRegexes = [
            {
                ref: 'input_1',
                question: 'How many?',
                regex: '^[0-9]{3}+$',
                message: 'PCRE2 engine could not verify this pattern: WASM module failed to instantiate',
                reason: 'engine-unavailable'
            }
        ];

        await projectValidate.showInvalidRegexAlert(invalidRegexes, project);

        expect(rollbarService.criticalWithContext).toHaveBeenCalledWith(
            'project import: pattern unverifiable without PCRE2',
            { project, invalidRegexes }
        );

        expect(notificationService.showDismissAlert).toHaveBeenCalledWith(
            'This project cannot be added because its regular expressions could not be checked on this device. Please retry, or try another device.<br><br>"How many?" (^[0-9]{3}+$)',
            'Error',
            null,
            'OK'
        );
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unverifiable regex'));

        consoleWarnSpy.mockRestore();
    });

    it('shows the malformed-pattern alert when a project also has an unverifiable pattern', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const project = { slug: 'water12', ref: 'water12' };

        await projectValidate.showInvalidRegexAlert([
            {
                ref: 'input_1',
                question: 'Unverified?',
                regex: '^[0-9]{3}+$',
                message: 'PCRE2 engine could not verify this pattern: WASM module failed to instantiate',
                reason: 'engine-unavailable'
            },
            {
                ref: 'input_2',
                question: 'Broken?',
                regex: '(',
                message: 'PCRE2 compile error',
                reason: null
            }
        ], project);

        //retrying on another device cannot fix a broken pattern, so that alert wins
        expect(rollbarService.criticalWithContext).toHaveBeenCalledWith(
            'project import: invalid regex pattern',
            expect.objectContaining({ project })
        );
        expect(notificationService.showDismissAlert).toHaveBeenCalledWith(
            'The regular expression is invalid or malformed.<br><br>"Broken?" (()',
            'Error',
            docsUrl,
            'OK'
        );
        //both are still logged, each with its own prefix
        expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unverifiable regex'));

        consoleWarnSpy.mockRestore();
    });

    it('names the action that failed, not always an addition', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const project = { slug: 'water12', ref: 'water12' };
        const invalidRegexes = [
            {
                ref: 'input_1',
                question: 'How many?',
                regex: '^[0-9]{3}+$',
                message: 'PCRE2 engine could not verify this pattern: WASM module failed to instantiate',
                reason: 'engine-unavailable'
            }
        ];

        await projectValidate.showInvalidRegexAlert(invalidRegexes, project, 'update');

        expect(notificationService.showDismissAlert).toHaveBeenCalledWith(
            'This project cannot be updated because its regular expressions could not be checked on this device. Please retry, or try another device.<br><br>"How many?" (^[0-9]{3}+$)',
            'Error',
            null,
            'OK'
        );

        //the PWA opens a hosted project: neither "added" nor "updated" is right
        await projectValidate.showInvalidRegexAlert(invalidRegexes, project, 'open');

        expect(notificationService.showDismissAlert).toHaveBeenLastCalledWith(
            'This project cannot be opened because its regular expressions could not be checked on this device. Please retry, or try another device.<br><br>"How many?" (^[0-9]{3}+$)',
            'Error',
            null,
            'OK'
        );

        consoleWarnSpy.mockRestore();
    });

    it('lists every affected question and escapes project text', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await projectValidate.showInvalidRegexAlert([
            {
                ref: 'input_1',
                question: 'How many?',
                regex: '(',
                message: 'PCRE2 compile error',
                reason: null
            },
            {
                ref: 'input_2',
                question: '<b>Code?</b>',
                regex: '[a-',
                message: 'PCRE2 compile error',
                reason: null
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
