import { describe, it, expect, beforeEach, vi } from 'vitest';
import { branchEntryService } from '@/services/entry/branch-entry-service';
import { mediaService } from '@/services/entry/media-service';
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
        getExtraInputs: vi.fn(() => ({})),
        getBranchMediaQuestions: vi.fn(() => [])
    }
}));

vi.mock('@/services/entry/entry-common-service', () => ({
    entryCommonService: {
        setEntryTitle: vi.fn()
    }
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: {
        insertEntry: vi.fn(),
        insertTempBranchEntry: vi.fn().mockResolvedValue(),
        insertUniqueAnswers: vi.fn().mockResolvedValue(),
        moveBranchEntries: vi.fn().mockResolvedValue(),
        insertMedia: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/database/database-delete-service', () => ({
    databaseDeleteService: {
        deleteMediaFiles: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/entry/media-service', () => ({
    mediaService: {
        saveMedia: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/filesystem/delete-file-service', () => ({
    deleteFileService: {
        removeFiles: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/filesystem/move-file-service', () => ({
    moveFileService: {
        moveToAppProjectDir: vi.fn().mockResolvedValue()
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

describe('branchEntryService.saveEntry persistence scope', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    function initBranchEntry(answers) {
        return import('@/models/branch-entry-model.js').then(({ branchEntryModel }) => {
            branchEntryModel.initialise({
                entry_uuid: 'branch-1',
                owner_entry_uuid: 'parent-1',
                owner_input_ref: 'branch-owner',
                form_ref: 'form-1',
                parent_form_ref: 'form-1',
                project_ref: 'project-ref',
                answers,
                media: {},
                title: '',
                synced: 2,
                synced_error: '',
                can_edit: 1,
                created_at: '',
                is_remote: 0
            });
            return branchEntryModel;
        });
    }

    it('persists text edits to temp tables only, never to main tables', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { databaseInsertService } = await import('@/services/database/database-insert-service');
        useRootStore.mockReturnValue({ queueFilesToDelete: [] });
        await initBranchEntry({ 'q-text': { answer: 'hello' } });

        await branchEntryService.saveEntry(0);

        expect(databaseInsertService.insertTempBranchEntry).toHaveBeenCalledWith(
            expect.objectContaining({ answers: { 'q-text': { answer: 'hello' } } }),
            0
        );
        expect(databaseInsertService.insertEntry).not.toHaveBeenCalled();
        expect(databaseInsertService.moveBranchEntries).not.toHaveBeenCalled();
    });

    it('blanks its own queued answer at save, skipping foreign items', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        useRootStore.mockReturnValue({
            queueFilesToDelete: [
                { inputRef: 'b-photo', filenameStored: 'b-photo.jpg', file_path: '/p/', project_ref: 'project-ref', file_name: 'b-photo.jpg' },
                { inputRef: 'hierarchy-photo', filenameStored: 'h-photo.jpg', file_path: '/p/', project_ref: 'project-ref', file_name: 'h-photo.jpg' }
            ]
        });
        const branchEntryModel = await initBranchEntry({ 'b-photo': { answer: 'b-photo.jpg' } });

        await branchEntryService.saveEntry(0);

        expect(branchEntryModel.answers['b-photo'].answer).toBe('');
    });

    it('end-to-end: branch save defers deletion, hierarchy save executes it', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const actual = await vi.importActual('@/services/entry/media-service');
        const { deleteFileService } = await import('@/services/filesystem/delete-file-service');
        const { databaseDeleteService } = await import('@/services/database/database-delete-service');
        mediaService.saveMedia.mockImplementation((...args) => actual.mediaService.saveMedia(...args));
        const store = {
            language: 'en',
            tempDir: '/tmp/',
            queueFilesToDelete: [
                { inputRef: 'b-photo', filenameStored: 'b-photo.jpg', file_path: '/p/', project_ref: 'project-ref', file_name: 'b-photo.jpg' }
            ]
        };
        useRootStore.mockReturnValue(store);
        const branchEntryModel = await initBranchEntry({ 'b-photo': { answer: 'b-photo.jpg' } });

        //phase 1: branch save blanks the answer but deletes nothing
        await branchEntryService.saveEntry(1);
        expect(branchEntryModel.answers['b-photo'].answer).toBe('');
        expect(deleteFileService.removeFiles).not.toHaveBeenCalled();
        expect(store.queueFilesToDelete).toHaveLength(1);

        //phase 2: hierarchy save executes the deferred deletion project-wide
        await actual.mediaService.saveMedia({ isBranch: false, entryUuid: 'parent-1', media: {} }, 1);
        expect(deleteFileService.removeFiles).toHaveBeenCalledTimes(1);
        expect(databaseDeleteService.deleteMediaFiles).toHaveBeenCalledWith('project-ref', ['"b-photo.jpg"']);
        expect(store.queueFilesToDelete).toEqual([]);

        mediaService.saveMedia.mockReset();
        mediaService.saveMedia.mockResolvedValue();
    });
});

describe('branchEntryService.discardBranchDeleteQueue', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removes only the quitting branch media items, preserving hierarchy items', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { projectModel } = await import('@/models/project-model.js');
        projectModel.getBranchMediaQuestions.mockReturnValueOnce(['branch-photo']);
        const store = {
            queueFilesToDelete: [
                { inputRef: 'hierarchy-photo', file_name: 'hierarchy-photo.jpg' },
                { inputRef: 'branch-photo', file_name: 'branch-photo.jpg' }
            ]
        };
        useRootStore.mockReturnValueOnce(store);
        branchEntryService.entry = { formRef: 'form-ref', ownerInputRef: 'branch-owner' };

        branchEntryService.discardBranchDeleteQueue();

        expect(projectModel.getBranchMediaQuestions).toHaveBeenCalledWith('form-ref', 'branch-owner');
        expect(store.queueFilesToDelete).toEqual([
            { inputRef: 'hierarchy-photo', file_name: 'hierarchy-photo.jpg' }
        ]);
    });

    it('leaves an empty queue untouched without querying media refs', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { projectModel } = await import('@/models/project-model.js');
        const store = { queueFilesToDelete: [] };
        useRootStore.mockReturnValueOnce(store);
        branchEntryService.entry = { formRef: 'form-ref', ownerInputRef: 'branch-owner' };

        branchEntryService.discardBranchDeleteQueue();

        expect(projectModel.getBranchMediaQuestions).not.toHaveBeenCalled();
        expect(store.queueFilesToDelete).toEqual([]);
    });

    it('leaves the queue untouched when the branch has no media questions', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { projectModel } = await import('@/models/project-model.js');
        projectModel.getBranchMediaQuestions.mockReturnValueOnce([]);
        const queued = { inputRef: 'hierarchy-photo', file_name: 'hierarchy-photo.jpg' };
        const store = { queueFilesToDelete: [queued] };
        useRootStore.mockReturnValueOnce(store);
        branchEntryService.entry = { formRef: 'form-ref', ownerInputRef: 'branch-owner' };

        branchEntryService.discardBranchDeleteQueue();

        expect(store.queueFilesToDelete).toEqual([queued]);
    });

    it('end-to-end: quitting the branch discards its queue so hierarchy save deletes nothing', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const actual = await vi.importActual('@/services/entry/media-service');
        const { deleteFileService } = await import('@/services/filesystem/delete-file-service');
        const { databaseDeleteService } = await import('@/services/database/database-delete-service');
        const { databaseInsertService } = await import('@/services/database/database-insert-service');
        const { moveFileService } = await import('@/services/filesystem/move-file-service');
        const { projectModel } = await import('@/models/project-model.js');
        mediaService.saveMedia.mockImplementation((...args) => actual.mediaService.saveMedia(...args));
        projectModel.getBranchMediaQuestions.mockReturnValueOnce(['b-photo']);
        const store = {
            language: 'en',
            tempDir: '/tmp/',
            queueFilesToDelete: [
                { inputRef: 'b-photo', filenameStored: 'b-photo.jpg', file_path: '/p/', project_ref: 'project-ref', file_name: 'b-photo.jpg' }
            ]
        };
        useRootStore.mockReturnValue(store);
        branchEntryService.entry = { formRef: 'form-ref', ownerInputRef: 'branch-owner' };

        //quit the branch without saving: its queued deletion is discarded
        branchEntryService.discardBranchDeleteQueue();
        expect(store.queueFilesToDelete).toEqual([]);

        //hierarchy save deletes nothing queued but still moves its own new file
        await actual.mediaService.saveMedia({
            isBranch: false,
            entryUuid: 'parent-1',
            projectRef: 'project-ref',
            media: { 'parent-1': { 'h-photo': { cached: 'h-photo.jpg', stored: '', type: 'photo' } } }
        }, 1);
        expect(deleteFileService.removeFiles).not.toHaveBeenCalled();
        expect(databaseDeleteService.deleteMediaFiles).not.toHaveBeenCalled();
        expect(moveFileService.moveToAppProjectDir).toHaveBeenCalledWith('/tmp/h-photo.jpg', 'h-photo.jpg', 'photo', 'project-ref');
        expect(databaseInsertService.insertMedia).toHaveBeenCalled();

        mediaService.saveMedia.mockReset();
        mediaService.saveMedia.mockResolvedValue();
    });
});
