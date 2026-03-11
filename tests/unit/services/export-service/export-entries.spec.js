import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportService } from '@/services/export-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { notificationService } from '@/services/notification-service';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { CapacitorZip } from '@capgo/capacitor-zip';
import { Share } from '@capacitor/share';
import { utilsService } from '@/services/utilities/utils-service';
import { projectModel } from '@/models/project-model';
import { useRootStore } from '@/stores/root-store';

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
vi.mock('@/services/filesystem/export-media-service');
vi.mock('@/services/filesystem/write-file-service');
vi.mock('@/services/utilities/json-transformer-service');
vi.mock('@/models/project-model');
vi.mock('@/use/modals/use-modal-progress-export');
vi.mock('@capgo/capacitor-zip', () => ({ CapacitorZip: { zip: vi.fn() } }));
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }));
vi.mock('@/services/filesystem/delete-file-service', () => ({
    deleteFileService: { removeDirectoryIfExists: vi.fn() }
}));
vi.mock('@capacitor/filesystem', () => ({
    Directory: { Data: 'DATA', Documents: 'DOCUMENTS' },
    Filesystem: {
        getUri: vi.fn(),
        deleteFile: vi.fn(),
        rmdir: vi.fn()
    }
}));
vi.mock('@/config', () => ({ PARAMETERS: { ANDROID: 'android', APP_NAME: 'Epicollect5', DEBUG: false } }));

const MOCK_PROJECT_REF = 'project-ref-123';
const MOCK_PROJECT_SLUG = 'my-project';
const MOCK_EXPORT_PATH = `Epicollect5/${MOCK_PROJECT_SLUG}`;

const exportHierarchySpy = vi.spyOn(exportService, 'exportHierarchyEntries').mockResolvedValue();
const exportBranchSpy = vi.spyOn(exportService, 'exportBranchEntries').mockResolvedValue();
const exportMediaSpy = vi.spyOn(exportService, 'exportMedia').mockResolvedValue();

describe('exportService.exportEntriesZipArchive', () => {
    let mockRootStore;

    beforeEach(() => {
        vi.resetAllMocks();

        // fake root store
        mockRootStore = {
            language: 'en',
            device: { platform: 'android' },
            progressExport: { total: 0, done: 0 },
            isExportModalActive: false
        };
        useRootStore.mockReturnValue(mockRootStore);

        // Mock setProgressExport to update mockRootStore
        notificationService.setProgressExport = vi.fn();

        // database mocks
        databaseSelectService.countAllEntries.mockResolvedValue(10);
        databaseSelectService.countAllBranchEntries.mockResolvedValue(5);
        databaseSelectService.countAllMedia.mockResolvedValue(3);

        // utils/media
        utilsService.getExportPath.mockReturnValue(MOCK_EXPORT_PATH);
        mediaDirsService.getRelativeDataDirectoryForCapacitorFilesystem.mockReturnValue(Directory.Data);

        // delete directory / archive
        deleteFileService.removeDirectoryIfExists.mockResolvedValue(undefined);

        // Filesystem mocks
        Filesystem.getUri.mockResolvedValue({ uri: 'file:///mock/path/file.zip' });
        Filesystem.deleteFile.mockResolvedValue();
        Filesystem.rmdir.mockResolvedValue(undefined); // handle any direct rmdir calls

        // project name
        projectModel.getProjectName.mockReturnValue('My Project');

        // zip & share
        CapacitorZip.zip.mockResolvedValue();
        Share.share.mockResolvedValue({ activityType: 'com.apple.UIKit.activity.CopyToPasteboard' });

        // export spies
        exportHierarchySpy.mockResolvedValue();
        exportBranchSpy.mockResolvedValue();
        exportMediaSpy.mockResolvedValue();
    });

    it('should return true when share succeeds', async () => {
        const result = await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(result).toBe(true);
    });

    it('should return false when share is cancelled', async () => {
        Share.share.mockResolvedValue({ activityType: 'cancel' });
        const result = await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(result).toBe(false);
    });

    it('should return false when share throws', async () => {
        Share.share.mockRejectedValueOnce(new Error('User cancelled'));
        const result = await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(result).toBe(false);
    });

    it('should call countAllEntries, countAllBranchEntries, countAllMedia', async () => {
        await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(databaseSelectService.countAllEntries).toHaveBeenCalledWith(MOCK_PROJECT_REF);
        expect(databaseSelectService.countAllBranchEntries).toHaveBeenCalledWith(MOCK_PROJECT_REF);
        expect(databaseSelectService.countAllMedia).toHaveBeenCalledWith(MOCK_PROJECT_REF);
    });

    it('should add a 10% buffer to total for progress bar', async () => {
        await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(notificationService.setProgressExport).toHaveBeenCalledWith({ total: 20, done: 0 });
    });

    it('should add zero buffer when total entries is 0', async () => {
        databaseSelectService.countAllEntries.mockResolvedValue(0);
        databaseSelectService.countAllBranchEntries.mockResolvedValue(0);
        databaseSelectService.countAllMedia.mockResolvedValue(0);

        await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(mockRootStore.progressExport.total).toBe(0);
    });

    it('should call exportHierarchyEntries, exportBranchEntries, exportMedia', async () => {
        await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(exportHierarchySpy).toHaveBeenCalledWith(MOCK_PROJECT_REF, Directory.Data);
        expect(exportBranchSpy).toHaveBeenCalledWith(MOCK_PROJECT_REF, Directory.Data);
        expect(exportMediaSpy).toHaveBeenCalledWith(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG, Directory.Data);
    });

    it('should zip the archive and share it', async () => {
        await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(CapacitorZip.zip).toHaveBeenCalledWith(
            expect.objectContaining({ source: expect.any(String), destination: expect.any(String) })
        );
        expect(Share.share).toHaveBeenCalledWith(
            expect.objectContaining({ title: expect.stringContaining('Epicollect5') })
        );
    });

    it('should call deleteFileService to wipe previous archive and export dir', async () => {
        await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(deleteFileService.removeDirectoryIfExists).toHaveBeenCalledTimes(2);
    });

    it('should ignore "does not exist" error from Filesystem.rmdir', async () => {
        Filesystem.rmdir.mockRejectedValueOnce({ code: 'OS-PLUG-FILE-0013', message: 'Directory does not exist' });

        const result = await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(result).toBe(true);
    });

    it('should return false if removeDirectoryIfExists throws unexpected error', async () => {
        deleteFileService.removeDirectoryIfExists.mockRejectedValueOnce(new Error('Permission denied'));
        const result = await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(result).toBe(false);
    });

    it('should return false and not throw when the export pipeline fails', async () => {
        exportHierarchySpy.mockRejectedValueOnce(new Error('DB read failed'));
        const result = await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);
        expect(result).toBe(false);
    });

    it('should always reset progress and clean up zip in finally block', async () => {
        exportHierarchySpy.mockRejectedValueOnce(new Error('DB read failed'));

        await exportService.exportEntriesZipArchive(MOCK_PROJECT_REF, MOCK_PROJECT_SLUG);

        expect(mockRootStore.progressExport.total).toBe(0);
        expect(Filesystem.deleteFile).toHaveBeenCalled();
    });
});
