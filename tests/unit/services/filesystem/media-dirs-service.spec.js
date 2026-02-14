import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';
import { Filesystem } from '@capacitor/filesystem';
import { utilsService } from '@/services/utilities/utils-service';

// 1. Mock Dependencies
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        rmdir: vi.fn()
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getPlatformDocumentsFolder: vi.fn()
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

    describe('getExportMediaPath()', () => {
        it('returns path with App Name for Android', () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'android' };

            const path = mediaDirsService.getExportMediaPath('my-project');
            expect(path).toBe('Epicollect5/my-project');
        });

        it('returns only the slug for iOS', () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'ios' };

            const path = mediaDirsService.getExportMediaPath('my-project');
            expect(path).toBe('my-project');
        });

        it('cleans leading/trailing slashes from the slug', () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'ios' };

            const path = mediaDirsService.getExportMediaPath('/my-project/');
            expect(path).toBe('my-project');
        });
    });

    describe('removeExternalMediaDirs()', () => {
        const projectSlug = 'test-project';

        it('returns true if documentsFolder is not supported on platform', async () => {
            utilsService.getPlatformDocumentsFolder.mockReturnValue(null);

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug);
            expect(result).toBe(true);
            expect(Filesystem.rmdir).not.toHaveBeenCalled();
        });

        it('attempts to remove photo, audio, and video directories', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'android' };
            utilsService.getPlatformDocumentsFolder.mockReturnValue('DOCUMENTS');
            Filesystem.rmdir.mockResolvedValue({});

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug);

            expect(result).toBe(true);
            expect(Filesystem.rmdir).toHaveBeenCalledTimes(3);
            // Verify path construction for one of them
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'Epicollect5/test-project/photos',
                directory: 'DOCUMENTS'
            }));
        });

        it('returns true if a directory does not exist (swallows "not exist" error)', async () => {
            utilsService.getPlatformDocumentsFolder.mockReturnValue('DOCUMENTS');

            // Mock rmdir to throw "Directory does not exist"
            Filesystem.rmdir.mockRejectedValue({ message: 'Folder does not exist' });

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug);
            expect(result).toBe(true); // Should still be true
        });

        it('returns false if a directory removal fails for other reasons', async () => {
            utilsService.getPlatformDocumentsFolder.mockReturnValue('DOCUMENTS');

            // Mock rmdir to throw a permission error
            Filesystem.rmdir.mockRejectedValue({ message: 'Permission denied' });

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug);
            expect(result).toBe(false);
        });
    });
});
