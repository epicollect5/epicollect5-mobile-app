import { describe, it, expect, beforeEach, vi } from 'vitest';
import { entryService } from '@/services/entry/entry-service';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        queueFilesToDelete: []
    }))
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getProjectRef: vi.fn(() => 'project-ref'),
        getSlug: vi.fn(() => 'test-slug'),
        getLastUpdated: vi.fn(() => 'v1'),
        getExtraForm: vi.fn(() => ({})),
        getExtraInputs: vi.fn(() => ({})),
        getFormIndex: vi.fn(() => 0),
        getFormInputs: vi.fn(() => []),
        hasLocation: vi.fn(() => false)
    }
}));

vi.mock('@/models/form-model.js', () => ({
    formModel: {
        initialise: vi.fn(),
        getName: vi.fn(() => ''),
        inputs: []
    }
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => false),
        DEBUG: false
    }
}));

vi.mock('@/services/entry/entry-common-service', () => ({
    entryCommonService: {
        setEntryTitle: vi.fn()
    }
}));

vi.mock('@/services/entry/media-service', () => ({
    mediaService: {
        saveMedia: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getISODateTime: vi.fn(() => '2024-01-01T00:00:00.000Z'),
        arrayGroupBy: vi.fn(() => ({})),
        uuid: vi.fn(() => 'mock-uuid')
    }
}));

vi.mock('@/services/web-service', () => ({
    webService: {
        uploadEntryPWA: vi.fn()
    }
}));

vi.mock('@/services/utilities/json-transformer-service', () => ({
    JSONTransformerService: {
        makeJsonEntry: vi.fn(() => ({}))
    }
}));

vi.mock('@/services/database/database-update-service', () => ({
    databaseUpdateService: {
        unsyncParentEntry: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        selectParentEntry: vi.fn().mockResolvedValue({rows: {length: 0}}),
        selectTempBranches: vi.fn().mockResolvedValue({rows: {length: 0}})
    }
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: {
        insertEntry: vi.fn().mockResolvedValue(),
        insertUniqueAnswers: vi.fn().mockResolvedValue(),
        moveBranchEntries: vi.fn().mockResolvedValue(),
        moveUniqueAnswers: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/database/database-delete-service', () => ({
    databaseDeleteService: {
        removeUniqueAnswers: vi.fn().mockResolvedValue(),
        deleteTempBranchEntries: vi.fn().mockResolvedValue(),
        deleteTempUniqueAnswers: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/utilities/entries-download-progress-service', () => ({
    entriesDownloadProgressService: {
        clearProject: vi.fn()
    }
}));

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: {
        critical: vi.fn()
    }
}));

describe('entryService.saveEntry', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        entryService.entry = {
            canEdit: 1,
            answers: {},
            parentEntryUuid: 'parent-uuid',
            formRef: 'form-ref'
        };
    });

    it('clears the project download progress when saving a child entry', async () => {
        await entryService.saveEntry(0);

        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalledWith('project-ref');
        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalledTimes(1);
    });

    it('does not clear the project download progress when saving a top-level entry', async () => {
        entryService.entry.parentEntryUuid = '';

        await entryService.saveEntry(0);

        expect(entriesDownloadProgressService.clearProject).not.toHaveBeenCalled();
    });

    it('persists edited answers and promotes temp branches on save', async () => {
        const { databaseInsertService } = await import('@/services/database/database-insert-service');
        entryService.entry = {
            canEdit: 1,
            answers: { 'q-text': { answer: 'hello' } },
            parentEntryUuid: '',
            formRef: 'form-ref'
        };

        await entryService.saveEntry(0);

        expect(databaseInsertService.insertEntry).toHaveBeenCalledWith(
            expect.objectContaining({ answers: { 'q-text': { answer: 'hello' } } }),
            0
        );
        expect(databaseInsertService.moveBranchEntries).toHaveBeenCalledTimes(1);
    });

    it('skips foreign queued deletions instead of crashing the save', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const staleStore = {
            queueFilesToDelete: [{
                inputRef: 'branch-q1',
                filenameStored: 'branch-photo.jpg',
                file_path: '/data/photos/',
                project_ref: 'project-ref',
                file_name: 'branch-photo.jpg'
            }]
        };
        useRootStore.mockReturnValueOnce(staleStore);
        //parent entry answers never contain a branch inputRef (refs are
        //unique project-wide): previously this threw at answers[ref].answer
        entryService.entry.answers = {};

        await entryService.saveEntry(0);

        expect(entryService.entry.answers).toEqual({});
        const { rollbarService } = await import('@/services/utilities/rollbar-service');
        //a skipped foreign item is handled flow, not an error: no report
        expect(rollbarService.critical).not.toHaveBeenCalled();
    });

    it('reports genuine queue processing errors instead of failing silently', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { rollbarService } = await import('@/services/utilities/rollbar-service');
        useRootStore.mockReturnValueOnce({
            queueFilesToDelete: [{
                inputRef: 'q1',
                filenameStored: 'photo.jpg',
                file_path: '/data/photos/',
                project_ref: 'project-ref',
                file_name: 'photo.jpg'
            }]
        });
        //corrupt entry shape: answers missing entirely, so even the lookup throws
        entryService.entry.answers = undefined;

        await expect(entryService.saveEntry(0)).rejects.toThrow();

        expect(rollbarService.critical).toHaveBeenCalledWith(expect.any(Error));
    });
});

describe('entryService.removeTempBranches', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deletes temp branches and temp unique answers on quit', async () => {
        const { databaseSelectService } = await import('@/services/database/database-select-service');
        const { databaseDeleteService } = await import('@/services/database/database-delete-service');
        databaseSelectService.selectTempBranches.mockResolvedValueOnce({ rows: { length: 1 } });
        entryService.entry = { entryUuid: 'entry-1' };

        await entryService.removeTempBranches();

        expect(databaseDeleteService.removeUniqueAnswers).toHaveBeenCalledTimes(1);
        expect(databaseDeleteService.deleteTempBranchEntries).toHaveBeenCalledTimes(1);
        expect(databaseDeleteService.deleteTempUniqueAnswers).toHaveBeenCalledTimes(1);
    });

    it('resolves without deleting when no temp branches exist', async () => {
        const { databaseSelectService } = await import('@/services/database/database-select-service');
        const { databaseDeleteService } = await import('@/services/database/database-delete-service');
        databaseSelectService.selectTempBranches.mockResolvedValueOnce({ rows: { length: 0 } });
        entryService.entry = { entryUuid: 'entry-1' };

        await entryService.removeTempBranches();

        expect(databaseDeleteService.deleteTempBranchEntries).not.toHaveBeenCalled();
        expect(databaseDeleteService.deleteTempUniqueAnswers).not.toHaveBeenCalled();
    });
});

describe('entryService.setUpExisting', () => {
    it('resets a stale file delete queue from a previous quit-without-save', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const staleStore = {
            queueFilesToDelete: [{
                inputRef: 'q1',
                filenameStored: 'other-entry-photo.jpg',
                file_path: '/data/photos/',
                project_ref: 'project-ref',
                file_name: 'other-entry-photo.jpg'
            }],
            isPWA: false
        };
        useRootStore.mockReturnValueOnce(staleStore);

        await entryService.setUpExisting({ entryUuid: 'entry1', formRef: 'form-ref' });

        expect(staleStore.queueFilesToDelete).toEqual([]);
    });
});

describe('entryService.setUpNew', () => {
    it('resets a stale file delete queue from a previous quit-without-save', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const staleStore = {
            queueFilesToDelete: [{
                inputRef: 'q1',
                filenameStored: 'other-entry-photo.jpg',
                file_path: '/data/photos/',
                project_ref: 'project-ref',
                file_name: 'other-entry-photo.jpg'
            }]
        };
        useRootStore.mockReturnValueOnce(staleStore);

        entryService.setUpNew('form-ref', '', '');

        expect(staleStore.queueFilesToDelete).toEqual([]);
    });
});

describe('entryService.saveEntryPWA', () => {
    const serverResponse = {
        data: {
            data: {code: 'ec5_237', title: 'Entry successfully uploaded.'}
        }
    };

    function seedHierarchyEntry() {
        entryService.entry = {
            entryUuid: 'entry-uuid',
            parentEntryUuid: '',
            formRef: 'form-ref',
            parentFormRef: '',
            answers: {},
            title: 'title'
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        seedHierarchyEntry();
    });

    it('resolves the server response when queued branches upload cleanly', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { webService } = await import('@/services/web-service');
        webService.uploadEntryPWA.mockImplementation((slug, payload) => {
            //the queued local branches are uploaded first (array payload),
            //the hierarchy entry itself last
            return Promise.resolve(Array.isArray(payload) ? {} : serverResponse);
        });
        useRootStore.mockReturnValue({
            queueBranchUploadErrorsPWA: {},
            queueGlobalUploadErrorsPWA: [],
            queueTempBranchEntriesPWA: {
                'branch-ref': [{id: 'branch-uuid-1'}, {id: 'branch-uuid-2'}]
            }
        });

        const response = await entryService.saveEntryPWA();

        //the caller reads response.data.data.title for the success toast: a
        //bare resolve() throws there and misreports the success as a failure
        expect(response).toBe(serverResponse);
    });

    it('resolves the server response when there are no queued branches', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { webService } = await import('@/services/web-service');
        webService.uploadEntryPWA.mockResolvedValue(serverResponse);
        useRootStore.mockReturnValue({
            queueBranchUploadErrorsPWA: {},
            queueGlobalUploadErrorsPWA: [],
            queueTempBranchEntriesPWA: {}
        });

        const response = await entryService.saveEntryPWA();

        expect(response).toBe(serverResponse);
    });
});
