import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { commonValidate } from '@/services/validation/common-validate';
import { regexService } from '@/services/validation/regex-service';
import { rollbarService } from '@/services/utilities/rollbar-service';

//the engine and the reporter are the two side effects under test
vi.mock('@/services/validation/regex-service', () => ({
    regexService: {
        isAvailable: vi.fn(),
        test: vi.fn(),
        isMatchLimitError: vi.fn()
    }
}));

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: { criticalWithContext: vi.fn() }
}));

describe('commonValidate.checkRegex()', () => {

    let consoleWarnSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        commonValidate.resetErrors();
        regexService.isAvailable.mockResolvedValue(true);
        regexService.isMatchLimitError.mockReturnValue(false);
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    it('passes a matching answer', async () => {
        regexService.test.mockResolvedValue(true);

        await expect(commonValidate.checkRegex({ ref: 'matching', regex: '^[0-9]{3}$' }, '123')).resolves.toBe(true);

        expect(commonValidate.getErrors()).toEqual({});
        expect(rollbarService.criticalWithContext).not.toHaveBeenCalled();
    });

    it('flags a non-matching answer', async () => {
        regexService.test.mockResolvedValue(false);

        await expect(commonValidate.checkRegex({ ref: 'not_matching', regex: '^[0-9]{3}$' }, 'ab')).resolves.toBe(false);

        expect(commonValidate.getErrors()).toEqual({ not_matching: ['ec5_23'] });
    });

    it('skips the check when the question has no pattern', async () => {
        await expect(commonValidate.checkRegex({ ref: 'no_regex', regex: '' }, 'anything')).resolves.toBe(true);

        expect(regexService.test).not.toHaveBeenCalled();
    });

    it('accepts an undecidable answer when the match limit was hit', async () => {
        regexService.test.mockRejectedValue(new Error('match limit exceeded'));
        regexService.isMatchLimitError.mockReturnValue(true);

        //the engine compiled the pattern but could not decide this answer: blocking
        //the entry would be worse than the definition defect it comes from
        await expect(commonValidate.checkRegex({ ref: 'limit', regex: '^(a+)+$' }, 'aaaaaaaaab')).resolves.toBe(true);

        expect(commonValidate.getErrors()).toEqual({});
        expect(rollbarService.criticalWithContext).toHaveBeenCalledWith(
            'regex: answer accepted without evaluation',
            {
                ref: 'limit',
                regex: '^(a+)+$',
                reason: 'match limit reached, the answer could not be evaluated',
                matchLimitHit: true
            }
        );
    });

    it('accepts an answer the pattern failed to evaluate, reported as a different failure', async () => {
        regexService.test.mockRejectedValue(new Error('compilation exploded'));
        regexService.isMatchLimitError.mockReturnValue(false);

        await expect(commonValidate.checkRegex({ ref: 'broken', regex: '^broken$' }, 'x')).resolves.toBe(true);

        //the device is not at fault here, so this must not be reported as a limit hit
        expect(rollbarService.criticalWithContext).toHaveBeenCalledWith(
            'regex: answer accepted without evaluation',
            {
                ref: 'broken',
                regex: '^broken$',
                reason: 'compilation exploded',
                matchLimitHit: false
            }
        );
    });

    it('reports a pattern once, however many answers reach it', async () => {
        regexService.test.mockRejectedValue(new Error('match limit exceeded'));
        regexService.isMatchLimitError.mockReturnValue(true);
        const inputDetails = { ref: 'limit_twice', regex: '^(a+)+b$' };

        await commonValidate.checkRegex(inputDetails, 'aaaa');
        await commonValidate.checkRegex(inputDetails, 'aaaaaa');

        //a release build strips console.warn, so the report is the only signal left
        expect(rollbarService.criticalWithContext).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('accepts answers without reporting when the engine cannot load', async () => {
        regexService.isAvailable.mockResolvedValue(false);

        await expect(commonValidate.checkRegex({ ref: 'no_engine', regex: '^no_engine$' }, 'x')).resolves.toBe(true);

        //the engine reports its own init failure once per session
        expect(regexService.test).not.toHaveBeenCalled();
        expect(rollbarService.criticalWithContext).not.toHaveBeenCalled();
        expect(commonValidate.getErrors()).toEqual({});
    });
});
