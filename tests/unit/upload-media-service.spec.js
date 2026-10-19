import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { uploadMediaService } from '@/services/upload-media-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { utilsService } from '@/services/utilities/utils-service';
import { projectModel } from '@/models/project-model.js';

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: { getUser: vi.fn() }
}));

vi.mock('@/services/database/database-update-service', () => ({
    databaseUpdateService: { updateFileEntrySynced: vi.fn() }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        setProgressTransfer: vi.fn(),
        hideProgressDialog: vi.fn(),
        showToast: vi.fn()
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: { handleWebError: vi.fn() }
}));

vi.mock('@/services/utilities/json-transformer-service', () => ({
    JSONTransformerService: { makeJsonFileEntry: vi.fn(() => ({})) }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            status_codes: {
                ec5_116: 'Server error, please try again later.',
                ec5_77: 'Authentication error.',
                ec5_330: 'No internet connection.',
                ec5_125: 'Some errors occurred.'
            },
            labels: {}
        }
    }
}));

const mockUpload = vi.fn();

class MockFileTransfer {
    constructor() {
        this.upload = mockUpload;
    }
}

describe('uploadMediaService.execute()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.persistentDir = '/';
        rootStore.device = { platform: PARAMETERS.WEB };

        vi.spyOn(utilsService, 'getMIMEType').mockReturnValue('image/jpeg');
        vi.spyOn(utilsService, 'hasInternetConnection').mockResolvedValue(true);
        vi.spyOn(projectModel, 'getSlug').mockReturnValue('test-slug');
        vi.spyOn(projectModel, 'getServerUrl').mockReturnValue('https://localhost');

        databaseSelectService.getUser.mockResolvedValue({ rows: { length: 0 } });
        databaseUpdateService.updateFileEntrySynced.mockReset();
        databaseUpdateService.updateFileEntrySynced.mockResolvedValue({});

        mockUpload.mockClear();
        mockUpload.mockImplementation((file, url, onSuccess, onError, options) => {
            onSuccess({ responseCode: 200, response: '', bytesSent: 1 });
        });

        window.FileTransfer = MockFileTransfer;
        window.FileUploadOptions = class {};

        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not throw when two concurrent executions share the same files array', async () => {
        const file = { id: 1, file_type: PARAMETERS.QUESTION_TYPES.PHOTO, file_name: 'a.jpg', project_ref: 'p1' };
        const files = [file];

        //simulate a double tap on the upload button
        const first = uploadMediaService.execute(files, 1, 0);
        const second = uploadMediaService.execute(files, 1, 0);

        await vi.advanceTimersByTimeAsync(50 * PARAMETERS.DELAY_LONG);

        await expect(first).resolves.toBe(false);
        await expect(second).resolves.toBe(false);
        //only one run actually uploaded the file, the other finished cleanly
        expect(mockUpload).toHaveBeenCalledTimes(1);
    });

    it('uploads all files sequentially and resolves without errors', async () => {
        //mirror QA: 30 files spread across photo, audio and video types
        const types = [
            PARAMETERS.QUESTION_TYPES.PHOTO,
            PARAMETERS.QUESTION_TYPES.AUDIO,
            PARAMETERS.QUESTION_TYPES.VIDEO
        ];
        const files = [];
        for (let i = 0; i < 30; i++) {
            files.push({
                id: i + 1,
                file_type: types[i % types.length],
                file_name: 'file' + i + '.jpg',
                project_ref: 'p1'
            });
        }

        const promise = uploadMediaService.execute(files, 30, 0);

        await vi.advanceTimersByTimeAsync(100 * PARAMETERS.DELAY_LONG);

        await expect(promise).resolves.toBe(false);
        expect(mockUpload).toHaveBeenCalledTimes(30);
    });

    // The database layer only clears a stale error when the sync status is
    // SYNCED, and only records an error otherwise: the two are mutually
    // exclusive. A successful upload must therefore never be reported as
    // synced *with* an error, otherwise the error would be dropped.
    it('marks an uploaded file as synced without an error', async () => {
        const file = { id: 1, file_type: PARAMETERS.QUESTION_TYPES.PHOTO, file_name: 'a.jpg', project_ref: 'p1' };

        const promise = uploadMediaService.execute([file], 1, 0);

        await vi.advanceTimersByTimeAsync(50 * PARAMETERS.DELAY_LONG);

        await expect(promise).resolves.toBe(false);
        expect(databaseUpdateService.updateFileEntrySynced).toHaveBeenCalledWith(file.id, PARAMETERS.SYNCED_CODES.SYNCED, undefined);
    });

    it('marks a failed file as unsynced with the error, never as synced', async () => {
        const file = { id: 1, file_type: PARAMETERS.QUESTION_TYPES.PHOTO, file_name: 'a.jpg', project_ref: 'p1' };
        const serverError = { errors: [{ code: 'ec5_1' }] };

        mockUpload.mockImplementation((file, url, onSuccess, onError) => {
            onError({ body: JSON.stringify(serverError) });
        });

        const promise = uploadMediaService.execute([file], 1, 0);
        //the upload rejects while the timers run, so attach the handler now
        const rejection = expect(promise).rejects.toBeDefined();

        await vi.advanceTimersByTimeAsync(50 * PARAMETERS.DELAY_LONG);

        await rejection;
        expect(databaseUpdateService.updateFileEntrySynced).toHaveBeenCalledWith(file.id, PARAMETERS.SYNCED_CODES.UNSYNCED, serverError);

        //a file is never reported as synced while carrying an error
        databaseUpdateService.updateFileEntrySynced.mock.calls.forEach((call) => {
            expect(call[1] === PARAMETERS.SYNCED_CODES.SYNCED && call[2]).toBe(false);
        });
    });
});
