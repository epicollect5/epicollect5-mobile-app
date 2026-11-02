import { vi, describe, it, expect } from 'vitest';

//the engine is WASM: stub it so the cache, its cleanup and its failure path
//can all be observed
const { compiledHandles, engineState, createPCRE2Mock, rollbarCritical } = vi.hoisted(() => {
    const compiledHandles = [];
    const engineState = { fail: false };
    const createPCRE2Mock = async () => {
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
            patternInfo: () => ({})
        };
    };
    return { compiledHandles, engineState, createPCRE2Mock, rollbarCritical: vi.fn() };
});

vi.mock('pcre2-wasm', () => ({
    FLAGS: { UTF: 0x00080000 },
    PCRE2CompileError: class PCRE2CompileError extends Error {},
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

    it('reports an initialisation failure to Rollbar, once per session', async () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { regexService } = await loadService();
        engineState.fail = true;

        //supported devices all have WebAssembly: a failure is a defect to page on
        await expect(regexService.isAvailable()).resolves.toBe(false);
        await expect(regexService.isAvailable()).resolves.toBe(false);

        expect(rollbarCritical).toHaveBeenCalledTimes(1);
        expect(rollbarCritical).toHaveBeenCalledWith('regex: PCRE2 engine init failed', expect.any(Error));
        expect(rollbarCritical.mock.calls[0][1].message).toBe('WebAssembly.instantiate failed');

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
