import { describe, expect, it, vi } from 'vitest';
// scripts/ is outside src/, so the `@` alias does not reach it.
import {
    buildCheckPayload,
    isValidTokenFormat,
    loadPostToken,
    postCheckItem
} from '../../../scripts/check-rollbar-token.js';

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('isValidTokenFormat', () => {
    it('accepts hex project post tokens (32 chars and longer)', () => {
        expect(isValidTokenFormat(TOKEN)).toBe(true);
        expect(isValidTokenFormat(TOKEN.toUpperCase())).toBe(true);
        expect(isValidTokenFormat(TOKEN.repeat(3))).toBe(true);
    });

    it('rejects missing, short and non-hex tokens', () => {
        expect(isValidTokenFormat('')).toBe(false);
        expect(isValidTokenFormat(null)).toBe(false);
        expect(isValidTokenFormat(TOKEN.slice(0, 31))).toBe(false);
        expect(isValidTokenFormat(`z${TOKEN.slice(1)}`)).toBe(false);
    });
});

describe('loadPostToken', () => {
    it('prefers the environment over the env file', () => {
        expect(loadPostToken({ VITE_ROLLBAR_POST_TOKEN: TOKEN }, '/nonexistent/.env.local')).toBe(TOKEN);
    });

    it('falls back to the env file when the environment is empty', () => {
        expect(loadPostToken({}, '/nonexistent/.env.local')).toBe('');
    });
});

describe('buildCheckPayload', () => {
    it('marks the item as a disposable build check on a client platform', () => {
        const payload = buildCheckPayload('98.5.9');
        expect(payload.environment).toBe('build-check');
        expect(payload.platform).toBe('client');
        expect(payload.client.javascript.code_version).toBe('98.5.9');
        expect(payload.body.message.body).toContain('archive');
    });
});

describe('postCheckItem', () => {
    it('resolves on {"err":0} and posts to the item endpoint', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ err: 0, result: { uuid: 'abc' } })
        }));

        const result = await postCheckItem(TOKEN, { fetchImpl });

        expect(result).toMatchObject({ uuid: 'abc' });
        const [url, options] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://api.rollbar.com/api/1/item/');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body).access_token).toBe(TOKEN);
    });

    it('throws when the token is rejected', async () => {
        const fetchImpl = vi.fn(async () => ({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({ err: 1, message: 'invalid access token' })
        }));

        await expect(postCheckItem('0'.repeat(96), { fetchImpl })).rejects.toThrow('invalid access token');
    });

    it('throws when the network fails', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new Error('boom');
        });

        await expect(postCheckItem(TOKEN, { fetchImpl })).rejects.toThrow('boom');
    });
});
