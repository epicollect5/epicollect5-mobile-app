import { vi, describe, it, expect } from 'vitest';

//the engine is WASM: stub it so the cache, its cleanup and its failure path
//can all be observed
const { compiledHandles, engineState, createPCRE2Mock, rollbarCritical } = vi.hoisted(() => {
    const compiledHandles = [];
    const engineState = { fail: false, attempts: 0 };
    const createPCRE2Mock = async () => {
        engineState.attempts++;
        if (engineState.fail) {
            throw new Error('WebAssembly.instantiate failed');
        }
        return {
            compile: (pattern) => {
                const handle = {
                    pattern,
                    test: vi.fn(() => true),
                    destroy: vi.fn()
                };
                compiledHandles.push(handle);
                return handle;
            },
            patternInfo: (pattern) => {
                //stands in for the engine's compile error on a malformed pattern
                if (pattern === '(') {
                    throw new Error('PCRE2 compile error: missing closing parenthesis');
                }
                return {};
            }
        };
    };
    return { compiledHandles, engineState, createPCRE2Mock, rollbarCritical: vi.fn() };
});

vi.mock('pcre2-wasm', () => ({
    FLAGS: { UTF: 0x00080000 },
    PCRE2MatchError: class PCRE2MatchError extends Error {
        constructor (message, code) {
            super(message);
            this.code = code;
        }
    },
    createPCRE2: createPCRE2Mock
}));

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: { criticalWithContext: rollbarCritical }
}));

//a fresh module per test: the compiled-pattern cache is module state
async function loadService () {
    vi.resetModules();
    compiledHandles.length = 0;
    engineState.fail = false;
    engineState.attempts = 0;
    rollbarCritical.mockClear();
    return import('@/services/validation/regex-service');
}

function patternName (index) {
    return '^answer_' + index + '$';
}

describe('regexService pattern cache', () => {

    it('compiles a pattern once and reuses it for every answer', async () => {
        const { regexService } = await loadService();

        await regexService.test(patternName(0), 'a');
        await regexService.test(patternName(0), 'b');

        expect(compiledHandles).toHaveLength(1);
        //backtracking limits are applied on every match, not just the first
        expect(compiledHandles[0].test).toHaveBeenNthCalledWith(1, 'a', { matchLimit: 1000000, depthLimit: 500 });
        expect(compiledHandles[0].test).toHaveBeenNthCalledWith(2, 'b', { matchLimit: 1000000, depthLimit: 500 });
        expect(compiledHandles[0].destroy).not.toHaveBeenCalled();
    });

    it('destroys the oldest pattern once the cache is full', async () => {
        const { regexService, MAX_COMPILED_PATTERNS } = await loadService();

        for (let index = 0; index < MAX_COMPILED_PATTERNS; index++) {
            await regexService.test(patternName(index), 'a');
        }

        expect(compiledHandles.every((handle) => !handle.destroy.mock.calls.length)).toBe(true);

        //one pattern more than the cache holds: the least recently used goes
        await regexService.test(patternName(MAX_COMPILED_PATTERNS), 'a');

        expect(compiledHandles).toHaveLength(MAX_COMPILED_PATTERNS + 1);
        expect(compiledHandles[0].destroy).toHaveBeenCalledTimes(1);
        expect(compiledHandles[1].destroy).not.toHaveBeenCalled();
        expect(compiledHandles[compiledHandles.length - 1].destroy).not.toHaveBeenCalled();
    });

    it('keeps a pattern alive when it is used again', async () => {
        const { regexService, MAX_COMPILED_PATTERNS } = await loadService();

        for (let index = 0; index < MAX_COMPILED_PATTERNS; index++) {
            await regexService.test(patternName(index), 'a');
        }

        //reuse the oldest pattern, so it must no longer be evicted first
        await regexService.test(patternName(0), 'b');
        expect(compiledHandles).toHaveLength(MAX_COMPILED_PATTERNS);

        await regexService.test(patternName(MAX_COMPILED_PATTERNS), 'a');

        expect(compiledHandles[0].destroy).not.toHaveBeenCalled();
        expect(compiledHandles[1].destroy).toHaveBeenCalledTimes(1);
    });

    it('recovers when a retry of the initialisation succeeds', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { regexService } = await loadService();
        engineState.fail = true;

        await expect(regexService.isAvailable()).resolves.toBe(false);

        //transient failure (e.g. memory pressure at boot): the rejected promise
        //must not be cached for the rest of the session
        engineState.fail = false;
        await expect(regexService.isAvailable()).resolves.toBe(true);

        consoleWarnSpy.mockRestore();
    });

    it('reports an initialisation failure to Rollbar and stops retrying once spent', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { regexService, RegexEngineUnavailableError } = await loadService();
        engineState.fail = true;

        //supported devices all have WebAssembly: a failure is a defect to page on
        await expect(regexService.isAvailable()).resolves.toBe(false);
        await expect(regexService.isAvailable()).resolves.toBe(false);

        expect(rollbarCritical).toHaveBeenCalledTimes(2);
        expect(rollbarCritical).toHaveBeenCalledWith('regex: PCRE2 engine init failed', expect.any(Error));
        expect(rollbarCritical.mock.calls[0][1].message).toBe('WebAssembly.instantiate failed');

        //attempts are spent: a device where compilation is really blocked must not
        //re-run createPCRE2 (and re-report) on every answer
        await expect(regexService.isAvailable()).resolves.toBe(false);
        expect(engineState.attempts).toBe(2);
        expect(rollbarCritical).toHaveBeenCalledTimes(2);

        //the import path calls the engine directly: it must not retry either
        await expect(regexService.validatePattern('^[0-9]{3}$')).rejects.toBeInstanceOf(RegexEngineUnavailableError);
        expect(engineState.attempts).toBe(2);

        consoleWarnSpy.mockRestore();
    });

    it('classifies only the match-limit code as a match error', async () => {
        const { regexService } = await loadService();
        const { PCRE2MatchError } = await import('pcre2-wasm');

        expect(regexService.isMatchLimitError(new PCRE2MatchError('match limit exceeded', -47))).toBe(true);
        //a depth-limit hit carries the same class but a different defect
        expect(regexService.isMatchLimitError(new PCRE2MatchError('match depth limit exceeded', -53))).toBe(false);
        expect(regexService.isMatchLimitError(new Error('something else'))).toBe(false);
    });

    it('accepts a compilable pattern', async () => {
        const { regexService } = await loadService();

        await expect(regexService.validatePattern('^[0-9]{3}$')).resolves.toEqual({ valid: true, message: '' });
    });

    it('reports an inspection failure as an invalid pattern, not an engine failure', async () => {
        const { regexService } = await loadService();

        //the engine loaded and inspected it, so the definition is at fault
        await expect(regexService.validatePattern('(')).resolves.toEqual({
            valid: false,
            message: 'PCRE2 compile error: missing closing parenthesis'
        });
    });

    it('treats a non-string pattern as a malformed definition, not a device failure', async () => {
        const { regexService } = await loadService();

        await expect(regexService.validatePattern({})).resolves.toEqual({ valid: false, message: 'regex is not a string' });
        await expect(regexService.validatePattern(123)).resolves.toEqual({ valid: false, message: 'regex is not a string' });
    });

    it('throws a typed error when the engine cannot be loaded', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { regexService, RegexEngineUnavailableError } = await loadService();
        engineState.fail = true;

        //the caller must be able to tell a device-side failure from a bad pattern
        await expect(regexService.validatePattern('^[0-9]{3}$')).rejects.toBeInstanceOf(RegexEngineUnavailableError);
        await expect(regexService.validatePattern('^[0-9]{3}$')).rejects.toThrow('WebAssembly.instantiate failed');

        consoleWarnSpy.mockRestore();
    });

    it('recompiles a pattern that was evicted', async () => {
        const { regexService, MAX_COMPILED_PATTERNS } = await loadService();

        for (let index = 0; index <= MAX_COMPILED_PATTERNS; index++) {
            await regexService.test(patternName(index), 'a');
        }

        const compiledBefore = compiledHandles.length;
        await regexService.test(patternName(0), 'a');

        expect(compiledHandles.length).toBe(compiledBefore + 1);
        expect(compiledHandles[compiledHandles.length - 1].pattern).toBe(patternName(0));
    });
});
