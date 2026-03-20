import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportService } from '@/services/export-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { notificationService } from '@/services/notification-service';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';
import { Directory } from '@capacitor/filesystem';
import { utilsService } from '@/services/utilities/utils-service';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/stores/root-store');
vi.mock('@/services/utilities/utils-service');
vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        countAllEntries: vi.fn(),
        countAllBranchEntries: vi.fn(),
        countAllMedia: vi.fn()
    }
}));
vi.mock('@/services/notification-service');
vi.mock('@/services/filesystem/media-dirs-service');
vi.mock('@/services/filesystem/delete-file-service', () => ({
    deleteFileService: { removeDirectoryIfExists: vi.fn() }
}));
vi.mock('@/config', () => ({
    PARAMETERS: {
        ANDROID: 'android',
        APP_NAME: 'Epicollect5',
        DELAY_LONG: 1000,
        DEBUG: false }
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
        notificationService.setProgressExport.mockImplementation((p) => {
            mockRootStore.progressExport = p;
        });
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

    it('should ignore "does not exist" error when wiping previous export', async () => {
        deleteFileService.removeDirectoryIfExists.mockImplementationOnce(async () => {
            // simulate that it ignores the error internally
        });

        const result = await exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(result).toBe(MOCK_EXPORT_PATH);
    });

    it('should return false if removeDirectoryIfExists throws unexpected error', async () => {
        deleteFileService.removeDirectoryIfExists.mockRejectedValueOnce(new Error('Permission denied'));

        await expect(exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG))
            .rejects.toThrow('Permission denied');
    });

    it('should always hide modal on failure', async () => {
        // No need to call vi.useFakeTimers() - beforeEach already does it

        vi.spyOn(exportService, 'exportHierarchyEntries')
            .mockRejectedValueOnce(new Error('export failed'));

        const promise = exportService.sendToDevice(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        await expect(promise).rejects.toThrow('export failed');

        await flushPromises();

        vi.runAllTimers();
        await flushPromises(); // flush the async setTimeout callback

        expect(mockHide).toHaveBeenCalled();
    });
});
