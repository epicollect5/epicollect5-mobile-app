import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mediaService } from '@/services/entry/media-service';
import { PARAMETERS } from '@/config';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn()
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getProjectRef: vi.fn(() => 'project-ref')
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {}
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: {}
}));

vi.mock('@/services/database/database-delete-service', () => ({
    databaseDeleteService: {
        deleteMediaFiles: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/database/database-update-service', () => ({
    databaseUpdateService: {
        updateFileEntryIncomplete: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        mapMediaObjectToArray: vi.fn(() => [])
    }
}));

vi.mock('@/services/filesystem/move-file-service', () => ({
    moveFileService: {}
}));

vi.mock('@/services/filesystem/delete-file-service', () => ({
    deleteFileService: {
        removeFiles: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: {
        criticalWithContext: vi.fn()
    }
}));

function queuedFile() {
    return {
        inputRef: 'q-photo',
        filenameStored: 'photo.jpg',
        file_path: '/data/photos/',
        project_ref: 'project-ref',
        file_name: 'photo.jpg'
    };
}

describe('mediaService.saveMedia queued deletions', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('executes queued deletions on hierarchy save', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { deleteFileService } = await import('@/services/filesystem/delete-file-service');
        const { databaseDeleteService } = await import('@/services/database/database-delete-service');
        const store = {
            language: 'en',
            tempDir: '/tmp/',
            queueFilesToDelete: [queuedFile()]
        };
        useRootStore.mockReturnValue(store);

        await mediaService.saveMedia(
            { isBranch: false, entryUuid: 'entry-1', media: {} },
            PARAMETERS.SYNCED_CODES.SYNCED
        );

        expect(deleteFileService.removeFiles).toHaveBeenCalledTimes(1);
        expect(databaseDeleteService.deleteMediaFiles).toHaveBeenCalledWith('project-ref', ['"photo.jpg"']);
        expect(store.queueFilesToDelete).toEqual([]);
    });

    it('defers queued deletions on branch save, leaving the queue intact', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { deleteFileService } = await import('@/services/filesystem/delete-file-service');
        const { databaseDeleteService } = await import('@/services/database/database-delete-service');
        const store = {
            language: 'en',
            tempDir: '/tmp/',
            queueFilesToDelete: [queuedFile()]
        };
        useRootStore.mockReturnValue(store);

        await mediaService.saveMedia(
            { isBranch: true, entryUuid: 'branch-1', media: {} },
            PARAMETERS.SYNCED_CODES.SYNCED
        );

        expect(deleteFileService.removeFiles).not.toHaveBeenCalled();
        expect(databaseDeleteService.deleteMediaFiles).not.toHaveBeenCalled();
        expect(store.queueFilesToDelete).toHaveLength(1);
    });

    it('reports failed queued-file removal to Rollbar', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { deleteFileService } = await import('@/services/filesystem/delete-file-service');
        const { rollbarService } = await import('@/services/utilities/rollbar-service');
        deleteFileService.removeFiles.mockRejectedValueOnce(new Error('disk gone'));
        useRootStore.mockReturnValue({
            language: 'en',
            tempDir: '/tmp/',
            queueFilesToDelete: [queuedFile()]
        });

        await expect(mediaService.saveMedia(
            { isBranch: false, entryUuid: 'entry-1', media: {} },
            PARAMETERS.SYNCED_CODES.SYNCED
        )).rejects.toThrow('disk gone');

        expect(rollbarService.criticalWithContext).toHaveBeenCalledWith(
            'saveMedia: failed to remove queued files',
            expect.any(Error)
        );
    });
});
