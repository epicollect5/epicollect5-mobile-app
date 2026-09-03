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

    function _setUpFs({failOnGetFile = false, failOnWriter = false, failOnRemove = false} = {}) {
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

        const mockExistingFile = {
            remove: vi.fn(function(success, error) {
                if (failOnRemove) {
                    error(new Error('remove failed'));
                } else {
                    success();
                }
            })
        };

        //virtual filesystem: tracks which filenames exist
        const virtualFs = new Set();

        const mockDirEntry = {
            getFile(filename, options, success, error) {
                if (options && options.create === false) {
                    //check existence
                    if (virtualFs.has(filename)) {
                        success(mockExistingFile);
                    } else {
                        error(new Error('NOT_FOUND'));
                    }
                } else {
                    //create: true — register in virtual FS
                    virtualFs.add(filename);
                    if (failOnGetFile) {
                        error(new Error('getFile failed'));
                    } else {
                        success(mockFile);
                    }
                }
            }
        };

        const mockDir = {lastUrl: ''};
        global.window.resolveLocalFileSystemURL = vi.fn((url, success) => {
            mockDir.lastUrl = url;
            success(mockDirEntry);
        });

        return {mockDir, mockFile, mockFileWriter, mockExistingFile, virtualFs};
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

        _setUpFs({failOnGetFile: true});

        await expect(saveBlobToTempDir({blob: {}, filename: 'x.jpg'}))
            .rejects.toThrow('getFile failed');
    });

    it('rejects when createWriter fails', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        _setUpFs({failOnWriter: true});

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

    it('removes existing file before recreating when filename already exists', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const { mockFileWriter, mockExistingFile, virtualFs } = _setUpFs({});
        const newBlob = {fake: 'new-blob'};

        //simulate file already existing in temp dir
        virtualFs.add('existing.jpg');

        const promise = saveBlobToTempDir({blob: newBlob, filename: 'existing.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        //remove was called on the existing entry before create: true
        expect(mockExistingFile.remove).toHaveBeenCalled();
        //the new blob was written, not the old one
        expect(mockFileWriter.write).toHaveBeenCalledWith(newBlob);
        expect(mockFileWriter.write).toHaveBeenCalledTimes(1);
    });

    it('creates new file when filename does not exist (no remove called)', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const { mockFileWriter, mockExistingFile } = _setUpFs({});

        const promise = saveBlobToTempDir({blob: {}, filename: 'fresh.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        //remove was never called because getFile({create:false}) returned NOT_FOUND
        expect(mockExistingFile.remove).not.toHaveBeenCalled();
        expect(mockFileWriter.write).toHaveBeenCalled();
    });

    it('writes a shorter replacement blob without trailing bytes', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const { mockFileWriter } = _setUpFs({});
        //first write: long blob
        const longBlob = {fake: 'long'};
        let promise = saveBlobToTempDir({blob: longBlob, filename: 'resize.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(mockFileWriter.write).toHaveBeenCalledWith(longBlob);

        //second write: shorter blob triggers remove-then-create
        mockFileWriter.write.mockClear();
        const shortBlob = {fake: 'short'};
        promise = saveBlobToTempDir({blob: shortBlob, filename: 'resize.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(mockFileWriter.write).toHaveBeenCalledWith(shortBlob);
        expect(mockFileWriter.write).toHaveBeenCalledTimes(1);
    });

    it('rejects when remove of existing file fails', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const { virtualFs } = _setUpFs({failOnRemove: true});

        //simulate file already existing in temp dir
        virtualFs.add('locked.jpg');

        await expect(saveBlobToTempDir({blob: {}, filename: 'locked.jpg'}))
            .rejects.toThrow('remove failed');
    });
});
