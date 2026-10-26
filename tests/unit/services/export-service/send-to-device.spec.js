import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportService } from '@/services/export-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { notificationService } from '@/services/notification-service';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { utilsService } from '@/services/utilities/utils-service';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model';
import { rollbarService } from '@/services/utilities/rollbar-service';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/stores/root-store');
vi.mock('@/services/utilities/utils-service');
vi.mock('@capacitor/filesystem', () => ({
    Directory: {
        Documents: 'DOCUMENTS',
        Data: 'DATA',
        Cache: 'CACHE'
    },
    Filesystem: {
        requestPermissions: vi.fn()
    }
}));
vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        countAllEntries: vi.fn(),
        countAllBranchEntries: vi.fn(),
        countAllMedia: vi.fn()
    }
}));
vi.mock('@/services/notification-service');
vi.mock('@/services/utilities/rollbar-service');
vi.mock('@/services/filesystem/media-dirs-service');
vi.mock('@/services/filesystem/delete-file-service', () => ({
    deleteFileService: { removeDirectoryIfExists: vi.fn() }
}));
vi.mock('@/config', () => ({
    PARAMETERS: {
        ANDROID: 'android',
        APP_NAME: 'Epicollect5',
        DELAY_LONG: 1000,
        DEBUG: false,
        PROJECT_VERSION_DOCS_URL: 'https://docs.example/project-version',
        EXPORT_FOLDER_DOCS_URL: 'https://docs.example/export-folder',
        EXPORT_FOLDER_NOT_WRITABLE: 'export_folder_not_writable',
        SHARE_STATUS: {
            SHARED: 1,
            NOT_SHARED: 0
        } }
}));

const MOCK_PROJECT_REF = 'project-ref-123';
const MOCK_PROJECT_SLUG = 'my-project';
const MOCK_EXPORT_PATH = `Epicollect5/${MOCK_PROJECT_SLUG}`;

describe('exportService.sendToDevice', () => {
    const mockShow = vi.fn();
    const mockHide = vi.fn();

    let mockRootStore;

    beforeEach(() => {
        // Enable fake timers to catch the setTimeouts
        vi.useFakeTimers();
        vi.resetAllMocks();

        // Fake root store
        mockRootStore = {
            language: 'en',
            progressExport: { total: 0, done: 0 },
            isExportModalActive: false,
            device: { platform: PARAMETERS.ANDROID }
        };
        useRootStore.mockReturnValue(mockRootStore);

        // Spies on exportService methods
        vi.spyOn(exportService, 'exportHierarchyEntries').mockResolvedValue();
        vi.spyOn(exportService, 'exportBranchEntries').mockResolvedValue();
        vi.spyOn(exportService, 'exportMedia').mockResolvedValue();

        // Spy notificationService modal methods
        vi.spyOn(notificationService, 'showProgressExportModal').mockImplementation(mockShow);
        vi.spyOn(notificationService, 'hideProgressExportModal').mockImplementation(mockHide);

        databaseSelectService.countAllEntries.mockResolvedValue(10);
        databaseSelectService.countAllBranchEntries.mockResolvedValue(5);
        databaseSelectService.countAllMedia.mockResolvedValue(3);

        utilsService.getExportPath.mockReturnValue(MOCK_EXPORT_PATH);
        mediaDirsService.getRelativeDataDirectoryForCapacitorFilesystem.mockReturnValue(Directory.Data);

        deleteFileService.removeDirectoryIfExists.mockResolvedValue(undefined);
        Filesystem.requestPermissions.mockResolvedValue({ publicStorage: 'granted' });
        notificationService.setProgressExport.mockImplementation((p) => {
            mockRootStore.progressExport = p;
        });

        //the project mapping is needed to name the CSV columns on export
        projectModel.loadMappings([{is_default: true, forms: {}}]);
    });

    afterEach(() => {
        vi.useRealTimers(); // Clean up after each test
    });

    it('should return the export path on success', async () => {
        // 1. Start the function but DO NOT 'await' it yet
        const exportPromise = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        // 2. Allow all the 'awaits' BEFORE the delay to resolve
        await vi.runAllTicks();

        // 3. Move the fake clock forward
        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);

        // 4. Now that the timer has fired, we can await the final result
        const result = await exportPromise;

        expect(result).toBe(MOCK_EXPORT_PATH);
    });

    it('should call countAllEntries, countAllBranchEntries, countAllMedia', async () => {
        await exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(databaseSelectService.countAllEntries).toHaveBeenCalledWith(MOCK_PROJECT_REF);
        expect(databaseSelectService.countAllBranchEntries).toHaveBeenCalledWith(MOCK_PROJECT_REF);
        expect(databaseSelectService.countAllMedia).toHaveBeenCalledWith(MOCK_PROJECT_REF);
    });

    it('should initialise progress to 0 and set to 100% at the end', async () => {
        const promise = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        await promise;

        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);

        expect(notificationService.setProgressExport).toHaveBeenCalledTimes(3);
        expect(notificationService.setProgressExport).toHaveBeenNthCalledWith(1, { total: 18, done: 0 });
        expect(notificationService.setProgressExport).toHaveBeenNthCalledWith(2, { total: 18, done: 3 });
        expect(notificationService.setProgressExport).toHaveBeenNthCalledWith(3, { total: 18, done: 18 });
    });

    it('should show and hide the progress modal', async () => {
        const promise = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        // Fast-forward through the DELAY_LONG timeout
        vi.runAllTimers();

        await promise;

        expect(mockShow).toHaveBeenCalled();
        expect(mockHide).toHaveBeenCalled();
    });

    it('should wipe the previous export directory before writing', async () => {
        await exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(deleteFileService.removeDirectoryIfExists).toHaveBeenCalledWith(
            MOCK_EXPORT_PATH,
            Directory.Documents
        );
    });

    it('should call exportHierarchyEntries, exportBranchEntries, exportMedia', async () => {
        await exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(exportService.exportHierarchyEntries).toHaveBeenCalledWith(MOCK_PROJECT_REF, Directory.Documents);
        expect(exportService.exportBranchEntries).toHaveBeenCalledWith(MOCK_PROJECT_REF, Directory.Documents);
        expect(exportService.exportMedia).toHaveBeenCalledWith(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG, Directory.Documents);
    });

    it('should request storage permission before doing any export work', async () => {
        await exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(Filesystem.requestPermissions).toHaveBeenCalledTimes(1);
        expect(Filesystem.requestPermissions.mock.invocationCallOrder[0])
            .toBeLessThan(databaseSelectService.countAllEntries.mock.invocationCallOrder[0]);
        expect(Filesystem.requestPermissions.mock.invocationCallOrder[0])
            .toBeLessThan(deleteFileService.removeDirectoryIfExists.mock.invocationCallOrder[0]);
    });

    it('should show a permission message, skip reporting and release the lock when storage permission is denied', async () => {
        Filesystem.requestPermissions.mockResolvedValueOnce({ publicStorage: 'denied' });

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toThrow(STRINGS.en.labels.missing_permission);

        expect(rollbarService.critical).not.toHaveBeenCalled();
        expect(databaseSelectService.countAllEntries).not.toHaveBeenCalled();
        expect(mockShow).not.toHaveBeenCalled();
        expect(deleteFileService.removeDirectoryIfExists).not.toHaveBeenCalled();

        //the lock must be released so the user can retry after granting it
        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .resolves.toBe(MOCK_EXPORT_PATH);
    });

    it('should map an OS-PLUG-FILE-0007 denial during the export to the permission message', async () => {
        exportService.exportHierarchyEntries.mockRejectedValueOnce(
            Object.assign(
                new Error('Unable to perform file operation, user denied permission request.'),
                { code: 'OS-PLUG-FILE-0007' }
            )
        );

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toThrow(STRINGS.en.labels.missing_permission);

        expect(rollbarService.critical).not.toHaveBeenCalled();
        //the partially written export is removed
        expect(deleteFileService.removeDirectoryIfExists).toHaveBeenCalledTimes(2);
    });

    it('should recognise the legacy denied-permission message without an error code', async () => {
        exportService.exportHierarchyEntries.mockRejectedValueOnce(
            new Error('Unable to do file operation, user denied permission request.')
        );

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toThrow(STRINGS.en.labels.missing_permission);

        expect(rollbarService.critical).not.toHaveBeenCalled();
    });

    it('should map the missing_permission label thrown by the media export', async () => {
        exportService.exportMedia.mockRejectedValueOnce(STRINGS.en.labels.missing_permission);

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toThrow(STRINGS.en.labels.missing_permission);

        expect(rollbarService.critical).not.toHaveBeenCalled();
    });

    it('should ignore "does not exist" error when wiping previous export', async () => {
        deleteFileService.removeDirectoryIfExists.mockImplementationOnce(async () => {
            // simulate that it ignores the error internally
        });

        const result = await exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(result).toBe(MOCK_EXPORT_PATH);
    });

    it('should report an unwritable previous export folder', async () => {
        exportService.exportHierarchyEntries.mockRejectedValueOnce(new Error(
            "'writeFile' failed with: /storage/emulated/0/Documents/Epicollect5/ec5-demo-project/data/form-1__form-1.csv: open failed: EACCES (Permission denied)"
        ));

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toMatchObject({
                code: PARAMETERS.EXPORT_FOLDER_NOT_WRITABLE,
                message: STRINGS.en.labels.export_folder_not_writable
            });
    });

    it('should recognize an EACCES error thrown as a string', async () => {
        exportService.exportHierarchyEntries.mockRejectedValueOnce(
            "'writeFile' failed: open failed: EACCES (Permission denied)"
        );

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toMatchObject({
                code: PARAMETERS.EXPORT_FOLDER_NOT_WRITABLE,
                message: STRINGS.en.labels.export_folder_not_writable
            });
    });

    it('should keep unrelated export failures generic', async () => {
        deleteFileService.removeDirectoryIfExists.mockRejectedValueOnce(new Error('Database failed'));

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toThrow('Unknown error');
        expect(rollbarService.critical).toHaveBeenCalled();
    });

    it('should always hide modal on failure', async () => {
        // No need to call vi.useFakeTimers() - beforeEach already does it

        vi.spyOn(exportService, 'exportHierarchyEntries')
            .mockRejectedValueOnce(new Error('export failed'));

        const promise = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        await expect(promise).rejects.toThrow('Unknown error');

        await flushPromises();

        vi.runAllTimers();
        await flushPromises(); // flush the async setTimeout callback

        expect(mockHide).toHaveBeenCalled();
    });

    it('should ignore a concurrent sendToDevice call while one is already in progress', async () => {
        let resolveHierarchy;
        exportService.exportHierarchyEntries.mockImplementationOnce(() => new Promise((resolve) => {
            resolveHierarchy = resolve;
        }));

        const firstPromise = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        await flushPromises();

        const secondResult = await exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(secondResult).toBeNull();
        expect(deleteFileService.removeDirectoryIfExists).toHaveBeenCalledTimes(1);

        resolveHierarchy();
        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);
        const firstResult = await firstPromise;
        expect(firstResult).toBe(MOCK_EXPORT_PATH);
    });

    it('should allow a new sendToDevice after a failure', async () => {
        vi.spyOn(exportService, 'exportHierarchyEntries')
            .mockRejectedValueOnce(new Error('export failed'));

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toThrow('Unknown error');

        const retry = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);
        await expect(retry).resolves.toBe(MOCK_EXPORT_PATH);
    });

    it('should block an archive export while sendToDevice is in progress', async () => {
        let resolveHierarchy;
        exportService.exportHierarchyEntries.mockImplementationOnce(() => new Promise((resolve) => {
            resolveHierarchy = resolve;
        }));

        const devicePromise = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        await flushPromises();

        const archiveResult = await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(archiveResult).toBe(PARAMETERS.SHARE_STATUS.NOT_SHARED);
        //the archive export must not have started its own work
        expect(databaseSelectService.countAllEntries).toHaveBeenCalledTimes(1);

        resolveHierarchy();
        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);
        await expect(devicePromise).resolves.toBe(MOCK_EXPORT_PATH);
    });

    it('should release the lock when the final modal dismissal fails', async () => {
        notificationService.hideProgressExportModal.mockRejectedValueOnce(new Error('overlay error'));

        const promise = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        await vi.runAllTicks();
        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);
        await expect(promise).rejects.toThrow('overlay error');

        //the lock must still be released so later exports are not blocked
        const retry = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        await vi.runAllTicks();
        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);
        await expect(retry).resolves.toBe(MOCK_EXPORT_PATH);
    });

    it('should release the lock when setup fails before the export starts', async () => {
        //setup (resolving the export path) throws before any export work runs
        utilsService.getExportPath.mockImplementationOnce(() => {
            throw new Error('bad slug');
        });

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toThrow('Unknown error');

        //the lock must still be released so later exports are not blocked
        const retry = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);
        await expect(retry).resolves.toBe(MOCK_EXPORT_PATH);
    });

    it('should alert the user and bail out when the project has no mapping', async () => {
        projectModel.loadMappings([]);

        const result = await exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(result).toBeNull();
        expect(notificationService.showDismissAlert).toHaveBeenCalledWith(
            STRINGS.en.labels.project_version_incompatible,
            STRINGS.en.labels.error,
            PARAMETERS.PROJECT_VERSION_DOCS_URL,
            STRINGS.en.labels.ok
        );
        //no doomed export work, no crash report
        expect(mockShow).not.toHaveBeenCalled();
        expect(databaseSelectService.countAllEntries).not.toHaveBeenCalled();
        expect(rollbarService.critical).not.toHaveBeenCalled();
    });

    it('should export normally once the project has a mapping again', async () => {
        projectModel.loadMappings([]);
        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG)).resolves.toBeNull();

        //the bail out must not leak the export lock
        projectModel.loadMappings([{is_default: true, forms: {}}]);
        const retry = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        vi.advanceTimersByTime(PARAMETERS.DELAY_LONG);
        await expect(retry).resolves.toBe(MOCK_EXPORT_PATH);
    });
});
