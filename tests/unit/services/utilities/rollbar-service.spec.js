import { describe, it, expect, vi, beforeEach } from 'vitest';

const rollbarInstance = vi.hoisted(() => ({
    critical: vi.fn(),
    configure: vi.fn()
}));

//captured once at import time, before beforeEach clears the mock call history:
//the SDK options are only passed to the constructor during module evaluation
const rollbarCtorOptions = vi.hoisted(() => ({ value: null }));

vi.mock('rollbar', () => ({
    default: vi.fn((options) => {
        rollbarCtorOptions.value = options;
        return rollbarInstance;
    })
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

describe('rollbarService ignoredMessages', () => {

    //replicates the SDK's messageIsIgnored predicate: each entry becomes a
    //case-insensitive RegExp tested against the reported error message
    const sdkDrops = (message) => rollbarCtorOptions.value.ignoredMessages.some(
        (pattern) => new RegExp(pattern, 'gi').test(message)
    );

    it('configures the SDK with one central suppression list', () => {
        expect(rollbarCtorOptions.value.ignoredMessages).toEqual([
            'user cancelled photos app',
            'user denied',
            'camera permission denied'
        ]);
    });

    it('drops deliberate user choices instead of paging us', () => {
        expect(sdkDrops('photoTake capture failed: User denied access to camera')).toBe(true);
        expect(sdkDrops('photoTake capture failed: User denied access to photos')).toBe(true);
        expect(sdkDrops('videoShoot capture failed: User denied access to camera')).toBe(true);
        expect(sdkDrops('CameraPreview.start failed: Camera permission denied')).toBe(true);
        expect(sdkDrops('CameraPreview restart failed: Camera permission denied')).toBe(true);
        //the native capgo message our own throw mirrors
        expect(sdkDrops('CameraPreview.start failed: camera permission denied. enable camera access in Settings.')).toBe(true);
        expect(sdkDrops('photoTake capture failed: User cancelled photos app')).toBe(true);
    });

    it('never drops genuine failures', () => {
        expect(sdkDrops('photoTake capture failed: move boom')).toBe(false);
        expect(sdkDrops('CameraPreview.start failed: camera in use')).toBe(false);
        //a broad "denied" would swallow a real filesystem permission error
        expect(sdkDrops('saveMedia: operation failed: EACCES: permission denied, open /tmp/photo.jpg')).toBe(false);
        expect(sdkDrops('boot: migrateDB failed: UNIQUE constraint failed')).toBe(false);
    });
});
