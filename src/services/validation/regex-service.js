import { createPCRE2, FLAGS, PCRE2MatchError } from 'pcre2-wasm';
import { rollbarService } from '@/services/utilities/rollbar-service';

// Project definitions are authored and validated with PHP's PCRE engine, so the
// app evaluates their patterns with PCRE2 instead of JavaScript's engine.
// JavaScript cannot compile PCRE-only syntax (possessive quantifiers, recursion,
// ...) and silently reinterprets escapes such as \A, \Q, \h and \R.
// See docs/ARCHITECTURE.md, "Answer Regex Evaluation", for the trade-offs.
const PATTERN_FLAGS = FLAGS.UTF; //multi-byte answers are matched as characters
//backtracking limits: a pathological pattern must never hang the UI
const MATCH_OPTIONS = { matchLimit: 1000000, depthLimit: 500 };
//PCRE2_ERROR_MATCHLIMIT: the step limit. A depth-limit hit (-53) is also a
//PCRE2MatchError but a different defect, and must not be reported as this one
const MATCH_LIMIT_ERROR_CODE = -47;
//compiled patterns hold WASM memory: keep the working set bounded
//(a project rarely has more distinct answer patterns than this)
export const MAX_COMPILED_PATTERNS = 50;
//one transient init failure (memory pressure at boot is the realistic case) must
//not cost the whole session, but retries are bounded: createPCRE2 costs 100-300ms
//and every attempt is reported, so retrying on each answer would be a flood on a
//device where compilation is really blocked
const MAX_ENGINE_ATTEMPTS = 2;

let enginePromise = null;
let engineAttempts = 0;
let engineUnavailable = false;
//insertion order doubles as recency: the oldest key is evicted first
const compiledPatterns = new Map();

function discardCompiledPattern (pattern) {
    const compiledPattern = compiledPatterns.get(pattern);
    if (!compiledPattern) {
        return;
    }
    compiledPatterns.delete(pattern);
    //compiled patterns allocate WASM memory, released only on destroy()
    compiledPattern.destroy();
}

function getCompiledPattern (pcre2, pattern) {
    const cachedPattern = compiledPatterns.get(pattern);
    if (cachedPattern) {
        //refresh recency
        compiledPatterns.delete(pattern);
        compiledPatterns.set(pattern, cachedPattern);
        return cachedPattern;
    }

    const compiledPattern = pcre2.compile(pattern, PATTERN_FLAGS);
    compiledPatterns.set(pattern, compiledPattern);

    if (compiledPatterns.size > MAX_COMPILED_PATTERNS) {
        discardCompiledPattern(compiledPatterns.keys().next().value);
    }

    return compiledPattern;
}

//Thrown when the engine itself could not be loaded. Callers must treat it as a
//device-side failure, and must not confuse it with a pattern the engine loaded
//fine and then rejected: that one is a defect in the project definition
export class RegexEngineUnavailableError extends Error {
    constructor (cause) {
        super(cause?.message ?? String(cause));
        this.name = 'RegexEngineUnavailableError';
        this.cause = cause;
    }
}

function getEngine () {
    if (engineUnavailable) {
        //attempts are spent: reject without touching the module again, so a device
        //where compilation is really blocked cannot retry (and re-report) on every
        //call. The init failure was already reported with its cause
        return Promise.reject(new Error('PCRE2 engine unavailable'));
    }
    if (!enginePromise) {
        engineAttempts++;
        enginePromise = createPCRE2().catch((error) => {
            //drop the rejected promise, so the next request can retry; only latch
            //once the attempts are spent
            enginePromise = null;
            engineUnavailable = (engineAttempts >= MAX_ENGINE_ATTEMPTS);
            console.warn('PCRE2 engine unavailable, regex validation is skipped: ' + error.message);
            //every supported device (Android 10+, iOS 16+) has WebAssembly, so a
            //failure here is a defect, not a device limitation: always report it
            rollbarService.criticalWithContext('regex: PCRE2 engine init failed', error);
            throw error;
        });
    }
    return enginePromise;
}

export const regexService = {

    // False when the WASM engine cannot be loaded on this device
    async isAvailable () {
        if (engineUnavailable) {
            return false;
        }
        try {
            await getEngine();
            return true;
        } catch (error) {
            return false;
        }
    },

    // True when a match failed because the pattern blew the backtracking limits:
    // the engine loaded and compiled it, but could not decide this answer. Very
    // different from the engine being unavailable, and the caller must not treat
    // the two the same
    isMatchLimitError (error) {
        return error instanceof PCRE2MatchError && error.code === MATCH_LIMIT_ERROR_CODE;
    },

    // Compile-only check, used when a project structure is imported.
    // Returns {valid, message} for every pattern it could inspect, however
    // malformed (including a non-string value); throws
    // RegexEngineUnavailableError only when the engine could not be loaded
    async validatePattern (pattern) {
        if (typeof pattern !== 'string') {
            //a truthy non-string is a malformed definition, not a device failure
            return {
                valid: false,
                message: 'regex is not a string'
            };
        }

        let pcre2;
        try {
            pcre2 = await getEngine();
        } catch (error) {
            throw new RegexEngineUnavailableError(error);
        }

        try {
            pcre2.patternInfo(pattern, PATTERN_FLAGS);
            return {
                valid: true,
                message: ''
            };
        } catch (error) {
            //the engine loaded but could not inspect this pattern: the definition
            //is at fault, so it must not be reported as a device problem
            return {
                valid: false,
                message: error.message
            };
        }
    },

    // Throws PCRE2CompileError (pattern unusable) or PCRE2MatchError (limit hit)
    async test (pattern, value) {
        const pcre2 = await getEngine();
        //compiled once per distinct pattern, reused for every answer
        return getCompiledPattern(pcre2, pattern).test(String(value), MATCH_OPTIONS);
    }
};
