import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rollbarInstance = vi.hoisted(() => ({
    critical: vi.fn(),
    configure: vi.fn()
}));

vi.mock('rollbar', () => ({
    default: vi.fn(() => rollbarInstance)
}));

import Rollbar from 'rollbar';
import { rollbarService } from '@/services/utilities/rollbar-service';

//constructor args are captured once at import, before any mock clearing
const rollbarConfig = Rollbar.mock.calls[0][0];

describe('rollbarService.criticalWithContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prefixes the operation context and preserves the original stack', () => {
        const error = new Error('boom');

        rollbarService.criticalWithContext('op failed', error);

        const reported = rollbarInstance.critical.mock.calls[0][0];
        const custom = rollbarInstance.critical.mock.calls[0][1];
        expect(reported).toBeInstanceOf(Error);
        expect(reported.message).toBe('op failed: boom');
        expect(reported.stack).toBe(error.stack);
        expect(custom).toMatchObject({ context: 'op failed' });
    });

    it('wraps plain error objects with the context so Rollbar gets a usable report', () => {
        rollbarService.criticalWithContext('op failed', { code: 5 });

        const reported = rollbarInstance.critical.mock.calls[0][0];
        const custom = rollbarInstance.critical.mock.calls[0][1];
        expect(reported).toBeInstanceOf(Error);
        expect(reported.message).toBe('op failed: {"code":5}');
        expect(custom).toMatchObject({ context: 'op failed', code: 5 });
    });

    it('never throws on circular values, so reporting cannot hide the original failure', () => {
        const circular = { code: 5 };
        circular.self = circular;

        expect(() => rollbarService.criticalWithContext('op failed', circular)).not.toThrow();

        const reported = rollbarInstance.critical.mock.calls[0][0];
        expect(reported).toBeInstanceOf(Error);
        expect(reported.message).toContain('op failed: ');
    });

    it('never throws on BigInt values', () => {
        expect(() => rollbarService.criticalWithContext('op failed', 10n)).not.toThrow();

        const reported = rollbarInstance.critical.mock.calls[0][0];
        expect(reported.message).toBe('op failed: 10');
    });

    it('never throws when toJSON throws', () => {
        const evil = { toJSON() { throw new Error('nope'); } };

        expect(() => rollbarService.criticalWithContext('op failed', evil)).not.toThrow();

        expect(rollbarInstance.critical).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ context: 'op failed' }));
    });

    it('caps functions to a short tag instead of serializing their source', () => {
        function namedFn() {}

        expect(() => rollbarService.criticalWithContext('op failed', namedFn)).not.toThrow();

        const reported = rollbarInstance.critical.mock.calls[0][0];
        expect(reported.message).toBe('op failed: [Function namedFn]');
    });

    it('never throws on symbols, undefined, or anonymous functions', () => {
        expect(() => rollbarService.criticalWithContext('op failed', Symbol('s'))).not.toThrow();
        expect(() => rollbarService.criticalWithContext('op failed', undefined)).not.toThrow();
        expect(() => rollbarService.criticalWithContext('op failed', () => {})).not.toThrow();

        expect(rollbarInstance.critical).toHaveBeenCalledTimes(3);
    });
});

describe('rollbarService config', () => {
    it('enables offline queueing with retryInterval', () => {
        expect(rollbarConfig.retryInterval).toBe(5000);
        expect(rollbarConfig.itemsPerMinute).toBe(1);
        expect(typeof rollbarConfig.checkIgnore).toBe('function');
    });
});

describe('rollbarService throttle (checkIgnore)', () => {
    const report = (context) => rollbarConfig.checkIgnore(false, [], { custom: { context } });

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sends the first report per context and suppresses the second within the window', () => {
        expect(report('op: one')).toBe(false);
        expect(report('op: one')).toBe(true);
    });

    it('keeps contexts isolated, so one noisy operation cannot starve another', () => {
        expect(report('op: a')).toBe(false);
        expect(report('op: a')).toBe(true);
        expect(report('op: b')).toBe(false);
    });

    it('sends again once the last report is older than the window', () => {
        const stale = String(Date.now() - 16 * 60 * 1000);
        localStorage.setItem('rollbar_last_report:op: stale', stale);

        expect(report('op: stale')).toBe(false);
    });

    it('treats a future timestamp (clock rollback) as expired and sends', () => {
        const future = String(Date.now() + 60 * 1000);
        localStorage.setItem('rollbar_last_report:op: rolled', future);

        expect(report('op: rolled')).toBe(false);
    });

    it('fails open when localStorage throws, so reporting never breaks', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage blocked');
        });

        expect(report('op: blocked')).toBe(false);
    });

    it('never throttles contextless legacy reports, so unrelated errors cannot hide each other', () => {
        expect(rollbarConfig.checkIgnore(false, [], {})).toBe(false);
        expect(rollbarConfig.checkIgnore(false, [], {})).toBe(false);
        expect(rollbarConfig.checkIgnore(true, [], undefined)).toBe(false);
        //no throttle key is ever written for contextless items
        expect(localStorage.length).toBe(0);
    });
});

describe('rollbarService.clearThrottleKeys', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('removes every throttle key on boot but leaves unrelated keys alone', () => {
        localStorage.setItem('rollbar_last_report:op a', String(Date.now()));
        localStorage.setItem('rollbar_last_report:op b', String(Date.now()));
        localStorage.setItem('unrelated_key', 'keep');

        rollbarService.clearThrottleKeys();

        expect(localStorage.getItem('rollbar_last_report:op a')).toBeNull();
        expect(localStorage.getItem('rollbar_last_report:op b')).toBeNull();
        expect(localStorage.getItem('unrelated_key')).toBe('keep');
    });

    it('is not triggered by configure(), so mid-session toggles keep the window', () => {
        localStorage.setItem('rollbar_last_report:op a', String(Date.now()));

        rollbarService.configure({ enabled: true });

        expect(localStorage.getItem('rollbar_last_report:op a')).not.toBeNull();
    });
});
