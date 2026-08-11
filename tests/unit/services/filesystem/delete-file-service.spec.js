// noinspection DuplicatedCode

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { Filesystem } from '@capacitor/filesystem';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';

vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        rmdir: vi.fn()
    }
}));

vi.mock('@/services/filesystem/media-dirs-service', () => ({
    mediaDirsService: {
        getRelativeDataDirectoryForCapacitorFilesystem: vi.fn()
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        ANDROID: 'android',
        IOS: 'ios',
        WEB: 'web',
        PWA: 'pwa',
        DEFAULT_LANGUAGE: 'en',
        PHOTO_DIR: 'photos/',
        AUDIO_DIR: 'audios/',
        VIDEO_DIR: 'videos/',
        LOGOS_DIR: 'logos/'
    }
}));

describe('deleteFileService', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mediaDirsService.getRelativeDataDirectoryForCapacitorFilesystem.mockReturnValue('DATA_DIR');
    });

    describe('removeProjectMediaDirectories()', () => {
        const projectRef = 'project-ref';

        it('skips removal on web platform', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'web' };

            const result = await deleteFileService.removeProjectMediaDirectories(projectRef);

            expect(result).toBe(true);
            expect(Filesystem.rmdir).not.toHaveBeenCalled();
        });

        it('removes photo, audio and video directories for a project', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'android' };
            Filesystem.rmdir.mockResolvedValue({});

            await deleteFileService.removeProjectMediaDirectories(projectRef);

            expect(Filesystem.rmdir).toHaveBeenCalledTimes(3);
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'photos/' + projectRef,
                directory: 'DATA_DIR',
                recursive: true
            }));
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'audios/' + projectRef,
                directory: 'DATA_DIR',
                recursive: true
            }));
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'videos/' + projectRef,
                directory: 'DATA_DIR',
                recursive: true
            }));
        });

        it('also removes the logos directory when includeLogos is true', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'ios' };
            Filesystem.rmdir.mockResolvedValue({});

            await deleteFileService.removeProjectMediaDirectories(projectRef, true);

            expect(Filesystem.rmdir).toHaveBeenCalledTimes(4);
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'logos/' + projectRef,
                directory: 'DATA_DIR',
                recursive: true
            }));
        });

        it('does not remove the logos directory when includeLogos is false', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'ios' };
            Filesystem.rmdir.mockResolvedValue({});

            await deleteFileService.removeProjectMediaDirectories(projectRef, false);

            expect(Filesystem.rmdir).toHaveBeenCalledTimes(3);
            expect(Filesystem.rmdir).not.toHaveBeenCalledWith(expect.objectContaining({
                path: 'logos/' + projectRef
            }));
        });

        it('resolves when a directory does not exist', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'android' };
            Filesystem.rmdir.mockRejectedValue({ message: 'Folder does not exist' });

            await expect(deleteFileService.removeProjectMediaDirectories(projectRef)).resolves.toBeUndefined();
        });

        it('resolves when a directory does not exist (iOS error code)', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'ios' };
            Filesystem.rmdir.mockRejectedValue({ code: 'OS-PLUG-FILE-0013' });

            await expect(deleteFileService.removeProjectMediaDirectories(projectRef)).resolves.toBeUndefined();
        });

        it('rejects when a directory removal fails for other reasons', async () => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'android' };
            Filesystem.rmdir.mockRejectedValue({ message: 'Permission denied' });

            await expect(deleteFileService.removeProjectMediaDirectories(projectRef)).rejects.toEqual({
                message: 'Permission denied'
            });
        });
    });
});