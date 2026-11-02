import { createPCRE2, FLAGS, PCRE2CompileError } from 'pcre2-wasm';
import { rollbarService } from '@/services/utilities/rollbar-service';

// Project definitions are authored and validated with PHP's PCRE engine, so the
// app evaluates their patterns with PCRE2 instead of JavaScript's engine.
// JavaScript cannot compile PCRE-only syntax (possessive quantifiers, recursion,
// ...) and silently reinterprets escapes such as \A, \Q, \h and \R.
// See docs/ARCHITECTURE.md, "Answer Regex Evaluation", for the trade-offs.
const PATTERN_FLAGS = FLAGS.UTF; //multi-byte answers are matched as characters
//backtracking limits: a pathological pattern must never hang the UI
const MATCH_OPTIONS = { matchLimit: 1000000, depthLimit: 500 };
//compiled patterns hold WASM memory: keep the working set bounded
//(a project rarely has more distinct answer patterns than this)
export const MAX_COMPILED_PATTERNS = 50;

//Escapes PCRE defines but JavaScript reads as the literal character (or, for
//\p and POSIX classes, as something else entirely): a pattern using them
//cannot be evaluated by the JavaScript fallback without changing its meaning
const PCRE_ONLY_SYNTAX = /\\[AzZGKRXChHNVepPgEQ]|\\x\{|\[\[[:.=]/;

let enginePromise = null;
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

function getEngine () {
    if (!enginePromise) {
        enginePromise = createPCRE2().catch((error) => {
            engineUnavailable = true;
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

    // True when only PCRE understands the pattern: JavaScript reads part of it
    // as literal characters. Import validation uses it to refuse definitions
    // the app could never evaluate without this engine
    usesPcreOnlySyntax (pattern) {
        return PCRE_ONLY_SYNTAX.test(String(pattern));
    },

    // Compile-only check, used when a project structure is imported
    async validatePattern (pattern) {
        const pcre2 = await getEngine();
        try {
            pcre2.patternInfo(pattern, PATTERN_FLAGS);
            return {
                valid: true,
                message: ''
            };
        } catch (error) {
            if (error instanceof PCRE2CompileError) {
                return {
                    valid: false,
                    message: error.message
                };
            }
            throw error;
        }
    },

    // Throws PCRE2CompileError (pattern unusable) or PCRE2MatchError (limit hit)
    async test (pattern, value) {
        const pcre2 = await getEngine();
        //compiled once per distinct pattern, reused for every answer
        return getCompiledPattern(pcre2, pattern).test(String(value), MATCH_OPTIONS);
    }
};
