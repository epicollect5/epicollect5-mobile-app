// noinspection DuplicatedCode

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { utilsService } from '@/services/utilities/utils-service';

// Add to the Directory mock
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        rmdir: vi.fn()
    },
    Directory: {
        Documents: 'DOCUMENTS',
        Data: 'DATA',
        LibraryNoCloud: 'LIBRARY_NO_CLOUD'  // ← add this
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getPlatformDocumentsFolder: vi.fn(),
        getExportPath: vi.fn((projectSlug, destination) => {
            if (destination === 'DATA' || destination === 'LIBRARY_NO_CLOUD') {
                return `archive/${projectSlug}`;
            }
            return `Epicollect5/${projectSlug}`;
        })
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        WEB: 'web',
        ANDROID: 'android',
        IOS: 'ios',
        APP_NAME: 'Epicollect5',
        PHOTO_DIR: 'photos',
        AUDIO_DIR: 'audio',
        VIDEO_DIR: 'video',
        LOGOS_DIR: 'logos/'
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
        it('attempts to remove photo, audio, and video directories (LibraryNoCloud/archive on iOS)', async () => {
            Filesystem.rmdir.mockResolvedValue({});

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug, Directory.LibraryNoCloud);

            expect(result).toBe(true);
            expect(Filesystem.rmdir).toHaveBeenCalledTimes(3);
            // Uses archive/ path and Directory.LibraryNoCloud when destination is LibraryNoCloud
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'archive/test-project/photos',
                directory: 'LIBRARY_NO_CLOUD'
            }));
            // getPlatformDocumentsFolder should NOT be called for LibraryNoCloud destination
            expect(utilsService.getPlatformDocumentsFolder).not.toHaveBeenCalled();
        });

        it('uses same archive path for both Data (Android) and LibraryNoCloud (iOS)', async () => {
            Filesystem.rmdir.mockResolvedValue({});

            await mediaDirsService.removeExternalMediaDirs(projectSlug, Directory.Data);
            const androidCall = Filesystem.rmdir.mock.calls[0][0];

            vi.clearAllMocks();
            Filesystem.rmdir.mockResolvedValue({});

            await mediaDirsService.removeExternalMediaDirs(projectSlug, Directory.LibraryNoCloud);
            const iosCall = Filesystem.rmdir.mock.calls[0][0];

            // Both platforms should use the same archive path structure
            expect(androidCall.path).toBe(iosCall.path);
            // But different directory constants
            expect(androidCall.directory).toBe('DATA');
            expect(iosCall.directory).toBe('LIBRARY_NO_CLOUD');
        });

        it('attempts to remove photo, audio, and video directories (Documents on iOS)', async () => {
            utilsService.getPlatformDocumentsFolder.mockReturnValue('DOCUMENTS');
            Filesystem.rmdir.mockResolvedValue({});

            const result = await mediaDirsService.removeExternalMediaDirs(projectSlug, Directory.Documents);

            expect(result).toBe(true);
            expect(Filesystem.rmdir).toHaveBeenCalledTimes(3);
            expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({
                path: 'Epicollect5/test-project/photos',
                directory: 'DOCUMENTS'
            }));
            expect(utilsService.getPlatformDocumentsFolder).toHaveBeenCalled();
        });
    });

    describe('ensureProjectLogoDir()', () => {
        const projectRef = 'abc123';

        beforeEach(() => {
            const rootStore = useRootStore();
            rootStore.device = { platform: 'android' };
            window.resolveLocalFileSystemURL = vi.fn();
            global.cordova = { file: { dataDirectory: 'file:///data/user/0/uk.ac.imperial.epicollect.five/files/' } };
        });

        it('creates the logos/<projectRef> directory when it is missing', async () => {
            let logosDir;
            const fileSystem = {
                getDirectory: vi.fn((name, opts, success) => {
                    logosDir = { name, getDirectory: vi.fn((n2, o2, s2) => s2({ name: n2 })) };
                    success(logosDir);
                })
            };
            window.resolveLocalFileSystemURL = vi.fn((path, success) => success(fileSystem));

            const result = await mediaDirsService.ensureProjectLogoDir(projectRef);

            expect(result).toBe(true);
            expect(window.resolveLocalFileSystemURL).toHaveBeenCalledWith(
                'file:///data/user/0/uk.ac.imperial.epicollect.five/files/',
                expect.any(Function),
                expect.any(Function)
            );
            expect(fileSystem.getDirectory).toHaveBeenCalledWith(
                'logos',
                { create: true, exclusive: false },
                expect.any(Function),
                expect.any(Function)
            );
            expect(logosDir.getDirectory).toHaveBeenCalledWith(
                projectRef,
                { create: true, exclusive: false },
                expect.any(Function),
                expect.any(Function)
            );
        });

        it('resolves immediately on web without touching the filesystem', async () => {
            useRootStore().device = { platform: 'web' };

            const result = await mediaDirsService.ensureProjectLogoDir(projectRef);

            expect(result).toBe(true);
            expect(window.resolveLocalFileSystemURL).not.toHaveBeenCalled();
        });

        it('rejects when the filesystem cannot be resolved', async () => {
            window.resolveLocalFileSystemURL = vi.fn((path, success, error) => error(new Error('resolve failed')));

            await expect(mediaDirsService.ensureProjectLogoDir(projectRef)).rejects.toThrow('resolve failed');
        });
    });
});
