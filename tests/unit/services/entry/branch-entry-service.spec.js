import { describe, it, expect, beforeEach, vi } from 'vitest';
import { branchEntryService } from '@/services/entry/branch-entry-service';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({}))
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

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: {
        insertTempBranchEntry: vi.fn().mockResolvedValue(),
        insertUniqueAnswers: vi.fn().mockResolvedValue()
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

describe('branchEntryService.saveEntry', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clears the project download progress when saving a branch entry', async () => {
        await branchEntryService.saveEntry(0);

        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalledWith('project-ref');
        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalledTimes(1);
    });
});
