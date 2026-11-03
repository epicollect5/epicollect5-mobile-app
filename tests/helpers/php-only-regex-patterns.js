/**
 * Regex patterns whose validity depends on the engine.
 *
 * Project definitions are authored and validated server-side with PHP's PCRE
 * engine, while the app now evaluates the same strings with PCRE2 in WASM
 * (src/services/validation/regex-service.js). Every pattern below is accepted
 * by PHP 8.3 and throws a SyntaxError in V8, so it is the reason the app cannot
 * use JavaScript's engine for project patterns.
 *
 * `matches` / `rejects` are sample answers verified with PHP 8.3:
 *   php -r 'var_dump(@preg_match("~" . $pattern . "~", $subject));'
 */
export const PHP_ONLY_REGEX_PATTERNS = [
    //possessive quantifiers
    { pattern: '^[0-9]{3}+$', description: 'possessive counted quantifier', matches: '123', rejects: '12' },
    { pattern: '^[0-9]++$', description: 'possessive one-or-more quantifier', matches: '123', rejects: 'abc' },
    { pattern: '^a*+b$', description: 'possessive zero-or-more quantifier', matches: 'aab', rejects: 'aac' },
    { pattern: '^a?+$', description: 'possessive optional quantifier', matches: 'a', rejects: 'aa' },
    { pattern: '^(?:ab)++$', description: 'possessive quantifier on a group', matches: 'abab', rejects: 'aba' },
    //PCRE group syntax
    { pattern: '^(?>a+)b$', description: 'atomic group', matches: 'aab', rejects: 'aac' },
    { pattern: '^(?i)abc$', description: 'inline case-insensitive modifier', matches: 'ABC', rejects: 'abd' },
    { pattern: '^(?P<code>[0-9]{3})$', description: 'Python-style named group', matches: '123', rejects: '12a' },
    { pattern: '^(a)?(?(1)b|c)$', description: 'conditional group', matches: 'ab', rejects: 'ac' },
    { pattern: '^(?|(a)|(b))$', description: 'branch reset group', matches: 'a', rejects: 'c' },
    { pattern: '^(?<x>a)?(?(<x>)b|c)$', description: 'conditional group by name', matches: 'ab', rejects: 'ac' },
    //recursion and subroutine calls
    { pattern: '\\((?:[^()]|(?R))*\\)', description: 'recursive subpattern (?R)', matches: '(a(b))', rejects: '(a' },
    { pattern: '^(a)(?1)$', description: 'numbered subroutine call', matches: 'aa', rejects: 'ab' },
    { pattern: '^(?P<word>[a-z]+)(?:\\s+(?P>word))?$', description: 'named subroutine call (?P>name)', matches: 'foo bar', rejects: 'foo 123' },
    { pattern: '^(?P<x>a)(?&x)$', description: 'named subroutine call (?&name)', matches: 'aa', rejects: 'ab' },
    { pattern: '^(a)?(?(R)b|c)$', description: 'recursion condition', matches: 'c', rejects: 'ab' },
    { pattern: '(?(DEFINE)(?<word>[a-z]+))(?&word)', description: 'DEFINE group with a subroutine call', matches: 'abc', rejects: '123' },
    //PCRE-only directives
    { pattern: 'a(*SKIP)(*FAIL)|b', description: 'backtracking control verbs', matches: 'b', rejects: 'a' },
    { pattern: '^(?C)(a)$', description: 'PCRE callout', matches: 'a', rejects: 'b' },
    { pattern: '^(?P<x>a)\\g{x}$', description: 'named backreference via g{name}', matches: 'aa', rejects: 'ab' }
];

/**
 * Patterns both engines compile and read the same way: import validation accepts
 * them only when the PCRE2 engine is available. Without it they are refused as
 * unverifiable, like every other pattern.
 */
export const JS_VALID_REGEX_PATTERNS = [
    { pattern: '^[0-9]{3}$', description: 'counted repetition' },
    { pattern: '^.{1,20}$', description: 'bounded wildcard' },
    { pattern: '^(?<code>[0-9]{3})$', description: 'JavaScript named group' },
    { pattern: '(?<=a)b', description: 'lookbehind' }
];

/**
 * Patterns JavaScript compiles without complaint but reads differently: \A and
 * \z, \Q...\E, \h, \R, \p{...}, \x{...} and POSIX classes are identity
 * escapes or plain characters there. They are valid PCRE, so only PCRE2 may
 * enforce them: there is no JavaScript fallback, and import validation refuses
 * them as unverifiable when the engine cannot load rather than having
 * JavaScript read them as different text.
 */
export const PCRE_ONLY_ESCAPE_PATTERNS = [
    { pattern: '^\\Aabc\\z$', description: 'PCRE string anchors \\A and \\z' },
    { pattern: '^\\Q2.5\\E$', description: 'quoting \\Q...\\E' },
    { pattern: '^\\h+$', description: 'horizontal whitespace \\h' },
    { pattern: '^\\R$', description: 'line break \\R' },
    { pattern: '^\\p{L}+$', description: 'Unicode property \\p{...}' },
    { pattern: '^\\x{1F600}$', description: 'code point escape \\x{...}' },
    { pattern: '[[:alpha:]]+', description: 'POSIX character class' }
];

/**
 * Patterns neither engine compiles: these must still be rejected at import.
 */
export const MALFORMED_REGEX_PATTERNS = [
    { pattern: '(', description: 'unclosed group' },
    { pattern: '[a-', description: 'unclosed character class' },
    { pattern: 'a{2,1}', description: 'invalid quantifier range' }
];
