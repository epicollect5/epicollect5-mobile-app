import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { utilsService } from '@/services/utilities/utils-service';

// 1. Mock Dependencies
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        rmdir: vi.fn()
    },
    Directory: {
        Documents: 'DOCUMENTS',
        Data: 'DATA'
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getPlatformDocumentsFolder: vi.fn(),
        getExportPath: vi.fn((projectSlug, destination) =>
            destination === 'DATA'  // compare against the raw string, not Directory.Data
                ? `archive/${projectSlug}`
                : `Epicollect5/${projectSlug}`
        )
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        ANDROID: 'android',
        IOS: 'ios',
        APP_NAME: 'Epicollect5',
        PHOTO_DIR: 'photos',
        AUDIO_DIR: 'audio',
        VIDEO_DIR: 'video'
    }
}));

describe('mediaDirsService', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    describe('removeExternalMediaDirs()', () => {
        const projectSlug = 'test-project';

        it('returns true if documentsFolder is not supported on platform', async () => {
            utilsService.getPlatformDocumentsFolder.mockReturnValue(null);

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug);
            expect(result).toBe(true);
            expect(Filesystem.rmdir).not.toHaveBeenCalled();
        });

        it('attempts to remove photo, audio, and video directories (Documents)', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'android' };
            utilsService.getPlatformDocumentsFolder.mockReturnValue('DOCUMENTS');
            Filesystem.rmdir.mockResolvedValue({});

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug, Directory.Documents);

            expect(result).toBe(true);
            expect(Filesystem.rmdir).toHaveBeenCalledTimes(3);
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'Epicollect5/test-project/photos',
                directory: 'DOCUMENTS'
            }));
        });

        it('attempts to remove photo, audio, and video directories (Data/archive)', async () => {
            Filesystem.rmdir.mockResolvedValue({});

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug, Directory.Data);

            expect(result).toBe(true);
            expect(Filesystem.rmdir).toHaveBeenCalledTimes(3);
            // Uses archive/ path and Directory.Data when destination is Data
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'archive/test-project/photos',
                directory: 'DATA'
            }));
            // getPlatformDocumentsFolder should NOT be called for Data destination
            expect(utilsService.getPlatformDocumentsFolder).not.toHaveBeenCalled();
        });

        it('returns true if a directory does not exist (swallows "not exist" error)', async () => {
            utilsService.getPlatformDocumentsFolder.mockReturnValue('DOCUMENTS');
            Filesystem.rmdir.mockRejectedValue({ message: 'Folder does not exist' });

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug);
            expect(result).toBe(true);
        });

        it('returns false if a directory removal fails for other reasons', async () => {
            utilsService.getPlatformDocumentsFolder.mockReturnValue('DOCUMENTS');
            Filesystem.rmdir.mockRejectedValue({ message: 'Permission denied' });

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug);
            expect(result).toBe(false);
        });
    });
});
