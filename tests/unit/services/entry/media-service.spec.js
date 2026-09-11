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
    databaseInsertService: {
        insertMedia: vi.fn().mockResolvedValue()
    }
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
    moveFileService: {
        moveToAppProjectDir: vi.fn().mockResolvedValue()
    }
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

describe('mediaService.saveMedia file staging', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    function hierarchyStore(queueFilesToDelete = []) {
        return {
            language: 'en',
            tempDir: '/tmp/',
            queueFilesToDelete
        };
    }

    it('overwrites the stored filename with the cached content on edit', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { utilsService } = await import('@/services/utilities/utils-service');
        const { moveFileService } = await import('@/services/filesystem/move-file-service');
        useRootStore.mockReturnValue(hierarchyStore());
        //edit flow: fresh temp capture staged under the live stored name
        utilsService.mapMediaObjectToArray.mockReturnValueOnce([
            { cached: 'C.jpg', stored: 'F.jpg', type: 'photo' }
        ]);

        await mediaService.saveMedia(
            { isBranch: false, entryUuid: 'entry-1', media: {} },
            PARAMETERS.SYNCED_CODES.SYNCED
        );

        expect(moveFileService.moveToAppProjectDir).toHaveBeenCalledTimes(1);
        expect(moveFileService.moveToAppProjectDir).toHaveBeenCalledWith('/tmp/C.jpg', 'F.jpg', 'photo', 'project-ref');
    });

    it('saves under the cached filename when nothing is stored', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { utilsService } = await import('@/services/utilities/utils-service');
        const { moveFileService } = await import('@/services/filesystem/move-file-service');
        useRootStore.mockReturnValue(hierarchyStore());
        utilsService.mapMediaObjectToArray.mockReturnValueOnce([
            { cached: 'C.jpg', stored: '', type: 'photo' }
        ]);

        await mediaService.saveMedia(
            { isBranch: false, entryUuid: 'entry-1', media: {} },
            PARAMETERS.SYNCED_CODES.SYNCED
        );

        expect(moveFileService.moveToAppProjectDir).toHaveBeenCalledWith('/tmp/C.jpg', 'C.jpg', 'photo', 'project-ref');
    });

    it('moves nothing for stored-only entries (display and reuse only)', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { utilsService } = await import('@/services/utilities/utils-service');
        const { moveFileService } = await import('@/services/filesystem/move-file-service');
        useRootStore.mockReturnValue(hierarchyStore());
        utilsService.mapMediaObjectToArray.mockReturnValueOnce([
            { cached: '', stored: 'F.jpg', type: 'photo' }
        ]);

        await mediaService.saveMedia(
            { isBranch: false, entryUuid: 'entry-1', media: {} },
            PARAMETERS.SYNCED_CODES.SYNCED
        );

        expect(moveFileService.moveToAppProjectDir).not.toHaveBeenCalled();
    });

    it('removes queued deletions before staging new files', async () => {
        const { useRootStore } = await import('@/stores/root-store');
        const { utilsService } = await import('@/services/utilities/utils-service');
        const { moveFileService } = await import('@/services/filesystem/move-file-service');
        const { deleteFileService } = await import('@/services/filesystem/delete-file-service');
        useRootStore.mockReturnValue(hierarchyStore([queuedFile()]));
        utilsService.mapMediaObjectToArray.mockReturnValueOnce([
            { cached: 'C.jpg', stored: '', type: 'photo' }
        ]);

        await mediaService.saveMedia(
            { isBranch: false, entryUuid: 'entry-1', media: {} },
            PARAMETERS.SYNCED_CODES.SYNCED
        );

        //delete-then-stage ordering is what keeps filename reuse safe: the
        //staged file can never collide with a pending deletion
        expect(deleteFileService.removeFiles).toHaveBeenCalledTimes(1);
        expect(moveFileService.moveToAppProjectDir).toHaveBeenCalledTimes(1);
        const removeOrder = deleteFileService.removeFiles.mock.invocationCallOrder[0];
        const moveOrder = moveFileService.moveToAppProjectDir.mock.invocationCallOrder[0];
        expect(removeOrder).toBeLessThan(moveOrder);
    });
});
