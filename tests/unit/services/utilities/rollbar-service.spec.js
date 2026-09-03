import { describe, it, expect, vi, beforeEach } from 'vitest';

const rollbarInstance = vi.hoisted(() => ({
    critical: vi.fn(),
    configure: vi.fn()
}));

vi.mock('rollbar', () => ({
    default: vi.fn(() => rollbarInstance)
}));

import { rollbarService } from '@/services/utilities/rollbar-service';

describe('rollbarService.criticalWithContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prefixes the operation context and preserves the original stack', () => {
        const error = new Error('boom');

        rollbarService.criticalWithContext('op failed', error);

        const reported = rollbarInstance.critical.mock.calls[0][0];
        expect(reported).toBeInstanceOf(Error);
        expect(reported.message).toBe('op failed: boom');
        expect(reported.stack).toBe(error.stack);
    });

    it('wraps plain error objects with the context so Rollbar gets a usable report', () => {
        rollbarService.criticalWithContext('op failed', { code: 5 });

        const reported = rollbarInstance.critical.mock.calls[0][0];
        expect(reported).toBeInstanceOf(Error);
        expect(reported.message).toBe('op failed: {"code":5}');
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

        expect(rollbarInstance.critical).toHaveBeenCalledWith(expect.any(Error));
    });
});
