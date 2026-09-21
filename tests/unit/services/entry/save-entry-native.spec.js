import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveEntryNative } from '@/services/entry/save-entry-native';
import { notificationService } from '@/services/notification-service';
import { questionCommonService } from '@/services/entry/question-common-service';
import { useRootStore } from '@/stores/root-store';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn()
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn().mockResolvedValue(),
        hideProgressDialog: vi.fn().mockResolvedValue(),
        showAlert: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/entry/question-common-service', () => ({
    questionCommonService: {
        getNavigationParams: vi.fn(() => ({ routeName: 'entries', routeParams: {} }))
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: {
        handleEntryErrors: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                wait: 'wait',
                saving: 'saving',
                error: 'error'
            }
        }
    }
}));

describe('saveEntryNative single-flight latch', () => {

    const saveEntry = vi.fn();
    const quit = vi.fn();
    let state;

    beforeEach(() => {
        vi.clearAllMocks();
        saveEntry.mockResolvedValue();
        state = {
            isSavingEntry: false,
            error: { errors: {} }
        };
        useRootStore.mockReturnValue({
            language: 'en',
            entriesAddScope: {
                entryService: {
                    saveEntry
                }
            }
        });
    });

    it('ignores a second tap while a save is in flight', async () => {
        let resolveSave;
        saveEntry.mockReturnValueOnce(new Promise((resolve) => {
            resolveSave = resolve;
        }));

        const first = saveEntryNative(state, 0, quit);
        const second = saveEntryNative(state, 0, quit);
        resolveSave();
        await first;
        await second;

        expect(saveEntry).toHaveBeenCalledTimes(1);
        expect(quit).toHaveBeenCalledTimes(1);
        expect(state.isSavingEntry).toBe(true);
    });

    it('ignores a replay after success (post-success navigation window)', async () => {
        await saveEntryNative(state, 0, quit);
        await saveEntryNative(state, 0, quit);

        expect(saveEntry).toHaveBeenCalledTimes(1);
        expect(quit).toHaveBeenCalledTimes(1);
        expect(state.isSavingEntry).toBe(true);
    });

    it('resets the latch on failure so a retry is possible', async () => {
        saveEntry.mockRejectedValueOnce({ message: 'db locked' });

        await saveEntryNative(state, 0, quit);

        expect(state.isSavingEntry).toBe(false);
        expect(quit).not.toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();

        await saveEntryNative(state, 0, quit);

        expect(saveEntry).toHaveBeenCalledTimes(2);
        expect(quit).toHaveBeenCalledTimes(1);
        expect(state.isSavingEntry).toBe(true);
    });

    it('resets the latch when navigation params throw', async () => {
        questionCommonService.getNavigationParams.mockImplementationOnce(() => {
            throw new Error('bad params');
        });

        await saveEntryNative(state, 0, quit);

        expect(state.isSavingEntry).toBe(false);
        expect(quit).not.toHaveBeenCalled();
    });
});
