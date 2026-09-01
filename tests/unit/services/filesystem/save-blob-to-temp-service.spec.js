import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { saveBlobToTempDir } from '@/services/filesystem/save-blob-to-temp-service';

vi.mock('@/config', () => ({
    PARAMETERS: {
        ANDROID: 'android',
        IOS: 'ios',
        WEB: 'web'
    }
}));

describe('saveBlobToTempDir', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        delete global.window.resolveLocalFileSystemURL;
    });

    function _setUpFs(mockDir, failOnGetFile = false, failOnWriter = false) {
        const mockFileWriter = {
            onwriteend: null,
            onerror: null,
            write: vi.fn(),
            _triggerWriteEnd() {
                if (this.onwriteend) {
                    this.onwriteend();
                }
            },
            _triggerError(err) {
                if (this.onerror) {
                    this.onerror(err);
                }
            }
        };

        const mockFile = {
            createWriter(success, error) {
                if (failOnWriter) {
                    error(new Error('createWriter failed'));
                } else {
                    success(mockFileWriter);
                }
            }
        };

        const mockDirEntry = {
            getFile(_filename, _options, success, error) {
                if (failOnGetFile) {
                    error(new Error('getFile failed'));
                } else {
                    success(mockFile);
                }
            }
        };

        global.window.resolveLocalFileSystemURL = vi.fn((url, success) => {
            mockDir.lastUrl = url;
            success(mockDirEntry);
        });

        return { mockDir, mockFile, mockFileWriter };
    }

    it('rejects on web platform', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'web' };
        rootStore.tempDir = '/tmp/';

        await expect(saveBlobToTempDir({blob: {}, filename: 'x.jpg'}))
            .rejects.toThrow('web');
    });

    it('rejects when blob is missing', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        await expect(saveBlobToTempDir({blob: null, filename: 'x.jpg'}))
            .rejects.toThrow('Missing blob');
    });

    it('rejects when filename is missing', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        await expect(saveBlobToTempDir({blob: {}, filename: ''}))
            .rejects.toThrow('Missing blob');
    });

    it('writes blob to temp dir on android without protocol prefix', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/data/cache/';

        const { mockDir, mockFileWriter } = _setUpFs({});
        const blob = {fake: 'blob'};

        const promise = saveBlobToTempDir({blob, filename: 'drawing.jpg'});
        mockFileWriter._triggerWriteEnd();
        const result = await promise;

        expect(result).toBe('drawing.jpg');
        expect(mockDir.lastUrl).toBe('/data/cache/');
        expect(mockFileWriter.write).toHaveBeenCalledWith(blob);
    });

    it('prefixes file:// on ios', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'ios' };
        rootStore.tempDir = '/var/mobile/Library/';

        const { mockDir, mockFileWriter } = _setUpFs({});
        const blob = {fake: 'blob'};

        const promise = saveBlobToTempDir({blob, filename: 'sig.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(mockDir.lastUrl).toBe('file:///var/mobile/Library/');
    });

    it('rejects when resolveLocalFileSystemURL fails', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        global.window.resolveLocalFileSystemURL = vi.fn((_url, _success, error) => {
            error(new Error('FS error'));
        });

        await expect(saveBlobToTempDir({blob: {}, filename: 'x.jpg'}))
            .rejects.toThrow('FS error');
    });

    it('rejects when getFile fails', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        _setUpFs({}, true);

        await expect(saveBlobToTempDir({blob: {}, filename: 'x.jpg'}))
            .rejects.toThrow('getFile failed');
    });

    it('rejects when createWriter fails', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        _setUpFs({}, false, true);

        await expect(saveBlobToTempDir({blob: {}, filename: 'x.jpg'}))
            .rejects.toThrow('createWriter failed');
    });

    it('rejects on fileWriter.onerror', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const { mockFileWriter } = _setUpFs({});

        const promise = saveBlobToTempDir({blob: {}, filename: 'x.jpg'});
        mockFileWriter._triggerError(new Error('write failed'));

        await expect(promise).rejects.toThrow('write failed');
    });
});
