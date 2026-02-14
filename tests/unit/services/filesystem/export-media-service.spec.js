import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { exportMediaService } from '@/services/filesystem/export-media-service';
import { Filesystem } from '@capacitor/filesystem';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';

// 1. Mock Capacitor Filesystem
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        requestPermissions: vi.fn(),
        stat: vi.fn(),
        mkdir: vi.fn(),
        copy: vi.fn()
    },
    Directory: {
        Documents: 'DOCUMENTS_DIR'
    }
}));

// 2. Mock Internal Services
vi.mock('@/services/filesystem/media-dirs-service', () => ({
    mediaDirsService: {
        getRelativeDataDirectoryForCapacitorFilesystem: vi.fn(),
        getExportMediaPath: vi.fn()
    }
}));

// 3. Mock Config & Strings
vi.mock('@/config', () => ({
    PARAMETERS: {
        PHOTO_DIR: 'photos',
        AUDIO_DIR: 'audio',
        VIDEO_DIR: 'video'
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                missing_permission: 'Permission Denied',
                unknown_error: 'Error'
            }
        }
    }
}));

describe('exportMediaService.execute()', () => {
    const projectRef = 'abc-123';
    const projectSlug = 'my-project';

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        const rootStore = useRootStore();
        rootStore.language = 'en';

        // Default: Source exists
        mediaDirsService.getRelativeDataDirectoryForCapacitorFilesystem.mockReturnValue('DATA_DIR');
        mediaDirsService.getExportMediaPath.mockReturnValue('Epicollect5/my-project');
    });

    it('throws error if permissions are not granted', async () => {
        Filesystem.requestPermissions.mockResolvedValue({ publicStorage: 'denied' });

        await expect(exportMediaService.execute(projectRef, projectSlug))
            .rejects.toBe('Permission Denied');
    });

    it('returns true immediately if source folder is null', async () => {
        Filesystem.requestPermissions.mockResolvedValue({ publicStorage: 'granted' });
        mediaDirsService.getRelativeDataDirectoryForCapacitorFilesystem.mockReturnValue(null);

        const result = await exportMediaService.execute(projectRef, projectSlug);
        expect(result).toBe(true);
        expect(Filesystem.stat).not.toHaveBeenCalled();
    });

    it('creates directory if it does not exist and copies media', async () => {
        Filesystem.requestPermissions.mockResolvedValue({ publicStorage: 'granted' });
        // Simulate folder NOT existing (stat throws)
        Filesystem.stat.mockRejectedValue(new Error('Not found'));
        Filesystem.mkdir.mockResolvedValue({});
        Filesystem.copy.mockResolvedValue({});

        const result = await exportMediaService.execute(projectRef, projectSlug);

        expect(result).toBe(true);
        expect(Filesystem.mkdir).toHaveBeenCalledWith(expect.objectContaining({
            path: 'Epicollect5/my-project',
            recursive: true
        }));
        // Should attempt to copy 3 times (Photos, Audio, Video)
        expect(Filesystem.copy).toHaveBeenCalledTimes(3);
        expect(Filesystem.copy).toHaveBeenCalledWith(expect.objectContaining({
            from: 'photos/abc-123',
            to: 'Epicollect5/my-project/photos'
        }));
    });

    it('skips folder creation if it already exists', async () => {
        Filesystem.requestPermissions.mockResolvedValue({ publicStorage: 'granted' });
        // Simulate folder existing (stat resolves)
        Filesystem.stat.mockResolvedValue({});

        await exportMediaService.execute(projectRef, projectSlug);

        expect(Filesystem.mkdir).not.toHaveBeenCalled();
    });

    it('continues copying even if one media type fails', async () => {
        Filesystem.requestPermissions.mockResolvedValue({ publicStorage: 'granted' });
        Filesystem.stat.mockResolvedValue({});

        // Mock copy to fail for photos but succeed for others
        Filesystem.copy
            .mockRejectedValueOnce(new Error('No photos'))
            .mockResolvedValue({});

        const result = await exportMediaService.execute(projectRef, projectSlug);

        expect(result).toBe(true);
        expect(Filesystem.copy).toHaveBeenCalledTimes(3);
    });

    it('throws unknown_error when a catastrophic failure occurs during directory creation', async () => {
        Filesystem.requestPermissions.mockResolvedValue({ publicStorage: 'granted' });

        // 1. Stat fails (swallowed internally to set folderExists = false)
        Filesystem.stat.mockRejectedValue(new Error('Not found'));

        // 2. Mkdir fails (This is NOT swallowed by an internal try/catch)
        // We throw an object without a 'message' property to trigger the fallback labels.unknown_error
        Filesystem.mkdir.mockImplementation(() => {
            throw {};
        });

        await expect(exportMediaService.execute(projectRef, projectSlug))
            .rejects.toBe('Error');
    });
});
