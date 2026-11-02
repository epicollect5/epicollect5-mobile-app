// Fails the prod build unless VITE_ROLLBAR_POST_TOKEN is present and well formed.
// Rollbar project post tokens are hex strings (32 chars on older projects,
// longer on newer ones - ours is 96); anything else means the app would ship
// with reporting silently disabled (the SDK never authenticates).
//
// Usage:
//   node scripts/check-rollbar-token.js [--live]
//
//     (no flags)  fail unless the token is set and well formed (safe on every build)
//     --live      also POST one `environment: build-check` item and fail unless
//                 the API answers {"err":0}. Every run creates a real item that
//                 has to be archived, so only run it manually before a release,
//                 never on every build.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ITEM_ENDPOINT = 'https://api.rollbar.com/api/1/item/';

export const isValidTokenFormat = (token) => {
    return typeof token === 'string' && /^[0-9a-f]{32,}$/i.test(token.trim());
};

const readEnvFile = (path) => {
    const values = {};
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return values;
    }
    for (const line of text.split(/\r?\n/)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
        if (!match) {
            continue;
        }
        values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
    return values;
};

export const loadPostToken = (env = process.env, envFile = join(ROOT, '.env.local')) => {
    const fromEnv = String(env.VITE_ROLLBAR_POST_TOKEN ?? '').trim().replace(/^['"]|['"]$/g, '');
    if (fromEnv) {
        return fromEnv;
    }
    const fileEnv = readEnvFile(envFile);
    return String(fileEnv.VITE_ROLLBAR_POST_TOKEN ?? '').trim().replace(/^['"]|['"]$/g, '');
};

export const buildCheckPayload = (version = null) => {
    return {
        environment: 'build-check',
        level: 'info',
        platform: 'client',
        body: {
            message: {
                body: 'pre-release post-token check (safe to archive)'
            }
        },
        ...(version ? { client: { javascript: { code_version: version } } } : {})
    };
};

export const postCheckItem = async (token, { fetchImpl = fetch, timeoutMs = 15000, version = null } = {}) => {
    let response;
    try {
        response = await fetchImpl(ITEM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, data: buildCheckPayload(version) }),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        throw new Error(`post check failed: ${error?.message ?? 'network error'}`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.err !== 0) {
        const message = body?.message ?? response.statusText ?? 'unknown error';
        throw new Error(`post check failed: HTTP ${response.status} ${message}`);
    }
    return body.result;
};

const usage = () => {
    return [
        'Usage: node scripts/check-rollbar-token.js [--live]',
        '',
        '  (no flags)  fail unless VITE_ROLLBAR_POST_TOKEN is set and well formed',
        '  --live      also POST one build-check item (creates a real item, archive it)',
        '  --help      this text'
    ].join('\n');
};

const main = async () => {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log(usage());
        return;
    }
    const live = args.includes('--live');

    const token = loadPostToken();
    if (!token) {
        console.error('check-rollbar-token: FAILED - VITE_ROLLBAR_POST_TOKEN is not set');
        console.error('  put it in .env.local or export it before building for production');
        process.exit(1);
    }
    if (!isValidTokenFormat(token)) {
        console.error('check-rollbar-token: FAILED - VITE_ROLLBAR_POST_TOKEN is malformed');
        console.error('  expected a hex project post token (32+ chars)');
        process.exit(1);
    }
    if (!live) {
        console.log('check-rollbar-token: OK (format valid, live post skipped)');
        return;
    }

    let version = null;
    try {
        version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version ?? null;
    } catch {
        version = null;
    }
    try {
        const result = await postCheckItem(token, { version });
        console.log(`check-rollbar-token: OK (live post accepted, uuid ${result?.uuid ?? 'n/a'} - archive it)`);
    } catch (error) {
        console.error(`check-rollbar-token: FAILED - live post rejected (${error.message})`);
        process.exit(1);
    }
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    main().catch((error) => {
        console.error(`check-rollbar-token: ${error.message}`);
        process.exit(1);
    });
}
