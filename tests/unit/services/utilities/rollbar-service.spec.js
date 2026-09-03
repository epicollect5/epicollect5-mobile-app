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
});
