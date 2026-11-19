import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveEntryPWA } from '@/services/entry/save-entry-pwa';
import { notificationService } from '@/services/notification-service';
import { questionCommonService } from '@/services/entry/question-common-service';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';

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
        handleWebError: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/models/project-model', () => ({
    projectModel: {
        getExtraInputs: vi.fn(() => ({}))
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                wait: 'wait',
                saving: 'saving',
                saving_with_encoding: 'saving_with_encoding'
            }
        }
    }
}));

describe('saveEntryPWA progress dialog', () => {

    const saveEntryMock = vi.fn();
    const quit = vi.fn();
    const entryUuid = 'entry-uuid';
    let entryService;
    let state;

    //media object as seeded by mediaService.getEntryStoredMediaPWA: one
    //filenamePWA bucket per media input, empty when the question is unanswered
    function mediaFile(cached, stored) {
        return { filenamePWA: { cached, stored } };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        saveEntryMock.mockResolvedValue();
        state = {
            entrySavedPWA: false,
            entryFailedPWA: false,
            showSave: false,
            showSaved: false,
            disablePrevious: false,
            disableNext: false,
            error: { errors: {} }
        };
        entryService = {
            entry: {
                entryUuid,
                media: {}
            },
            type: PARAMETERS.ENTRY,
            action: PARAMETERS.PWA_ADD_ENTRY,
            allowSave: false,
            saveEntryPWA: saveEntryMock
        };
        useRootStore.mockReturnValue({
            language: 'en',
            branchEditType: null,
            entriesAddScope: {
                entryService
            }
        });
    });

    it('shows the plain dialog when every media question is unanswered', async () => {
        //unanswered (or skipped) media questions still seed empty buckets
        entryService.entry.media = {
            [entryUuid]: {
                photo_ref: mediaFile('', ''),
                audio_ref: mediaFile('', '')
            }
        };

        await saveEntryPWA(state, quit);

        expect(notificationService.showProgressDialog).toHaveBeenCalledWith('wait', 'saving');
        expect(notificationService.showProgressDialog).not.toHaveBeenCalledWith('saving_with_encoding', 'wait');
        expect(saveEntryMock).toHaveBeenCalledTimes(1);
    });

    it('shows the plain dialog when stored files are untouched (already uploaded)', async () => {
        //editing an entry whose files are all stored: nothing is uploaded at
        //save, as files go up at pick time
        entryService.entry.media = {
            [entryUuid]: {
                photo_ref: mediaFile('', 'photo_1.jpg'),
                audio_ref: mediaFile('', 'audio_1.mp4'),
                video_ref: mediaFile('', 'video_1.mp4')
            }
        };

        await saveEntryPWA(state, quit);

        expect(notificationService.showProgressDialog).toHaveBeenCalledWith('wait', 'saving');
        expect(notificationService.showProgressDialog).not.toHaveBeenCalledWith('saving_with_encoding', 'wait');
    });

    it('shows the encoding dialog when a new file was picked (cached)', async () => {
        //a cached file alongside untouched stored ones still counts
        entryService.entry.media = {
            [entryUuid]: {
                photo_ref: mediaFile('photo_1.jpg', ''),
                audio_ref: mediaFile('', 'audio_1.mp4')
            }
        };

        await saveEntryPWA(state, quit);

        expect(notificationService.showProgressDialog).toHaveBeenCalledWith('saving_with_encoding', 'wait');
    });

    it('shows the plain dialog when the media object is empty', async () => {
        //on web debug media files are not available (entry.media = {})
        entryService.entry.media = {};

        await saveEntryPWA(state, quit);

        expect(notificationService.showProgressDialog).toHaveBeenCalledWith('wait', 'saving');
        expect(notificationService.showProgressDialog).not.toHaveBeenCalledWith('saving_with_encoding', 'wait');
    });

    it('shows the success screen after a hierarchy entry save', async () => {
        entryService.entry.media = {};

        await saveEntryPWA(state, quit);

        expect(entryService.allowSave).toBe(true);
        expect(state.action).toBe(PARAMETERS.PWA_ADD_ENTRY);
        expect(state.entrySavedPWA).toBe(true);
        expect(state.entryFailedPWA).toBe(false);
        expect(state.showSaved).toBe(true);
        expect(quit).not.toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
    });
});
