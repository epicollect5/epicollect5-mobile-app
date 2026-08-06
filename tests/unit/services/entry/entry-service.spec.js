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
        getExtraForm: vi.fn(() => ({})),
        getExtraInputs: vi.fn(() => ({}))
    }
}));

vi.mock('@/services/entry/entry-common-service', () => ({
    entryCommonService: {
        setEntryTitle: vi.fn()
    }
}));

vi.mock('@/services/database/database-update-service', () => ({
    databaseUpdateService: {
        unsyncParentEntry: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        selectParentEntry: vi.fn().mockResolvedValue({rows: {length: 0}})
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

vi.mock('@/services/entry/media-service', () => ({
    mediaService: {
        saveMedia: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/utilities/entries-download-progress-service', () => ({
    entriesDownloadProgressService: {
        clearProject: vi.fn()
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
});
