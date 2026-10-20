import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { keepAwakeService } from '@/services/keep-awake-service';
import { useRootStore } from '@/stores/root-store';

const keepAwakeMocks = vi.hoisted(() => ({
    keepAwake: vi.fn().mockResolvedValue(),
    allowSleep: vi.fn().mockResolvedValue(),
    isNativePlatform: vi.fn(() => true)
}));

vi.mock('@capacitor-community/keep-awake', () => ({
    KeepAwake: {
        keepAwake: keepAwakeMocks.keepAwake,
        allowSleep: keepAwakeMocks.allowSleep
    }
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: keepAwakeMocks.isNativePlatform
    }
}));

describe('keepAwakeService', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        keepAwakeMocks.isNativePlatform.mockReturnValue(true);
        keepAwakeMocks.keepAwake.mockResolvedValue();
        keepAwakeMocks.allowSleep.mockResolvedValue();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps the screen awake when the setting is enabled on a native platform', async () => {
        useRootStore().keepScreenOnDuringTransfer = true;

        await keepAwakeService.acquireTransferLock();

        expect(keepAwakeMocks.keepAwake).toHaveBeenCalledTimes(1);
    });

    it('allows the screen to sleep again on release', async () => {
        useRootStore().keepScreenOnDuringTransfer = true;

        await keepAwakeService.releaseTransferLock();

        expect(keepAwakeMocks.allowSleep).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the setting is disabled', async () => {
        useRootStore().keepScreenOnDuringTransfer = false;

        await keepAwakeService.acquireTransferLock();
        await keepAwakeService.releaseTransferLock();

        expect(keepAwakeMocks.keepAwake).not.toHaveBeenCalled();
        expect(keepAwakeMocks.allowSleep).not.toHaveBeenCalled();
    });

    it('does nothing on a non-native platform even when the setting is enabled', async () => {
        useRootStore().keepScreenOnDuringTransfer = true;
        keepAwakeMocks.isNativePlatform.mockReturnValue(false);

        await keepAwakeService.acquireTransferLock();
        await keepAwakeService.releaseTransferLock();

        expect(keepAwakeMocks.keepAwake).not.toHaveBeenCalled();
        expect(keepAwakeMocks.allowSleep).not.toHaveBeenCalled();
    });

    it('swallows a plugin failure so the transfer is never blocked', async () => {
        useRootStore().keepScreenOnDuringTransfer = true;
        keepAwakeMocks.keepAwake.mockRejectedValue(new Error('unsupported'));
        keepAwakeMocks.allowSleep.mockRejectedValue(new Error('unsupported'));
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await expect(keepAwakeService.acquireTransferLock()).resolves.toBeUndefined();
        await expect(keepAwakeService.releaseTransferLock()).resolves.toBeUndefined();

        expect(logSpy).toHaveBeenCalled();
    });
});
