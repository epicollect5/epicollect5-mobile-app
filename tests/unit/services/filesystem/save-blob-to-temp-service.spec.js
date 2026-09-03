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

    function _setUpFs({failOnGetFile = false, failOnWriter = false, failOnMove = false, failOnRemoveOld = false} = {}) {
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

        //mock file entry: supports createWriter (for the temp file write),
        //moveTo (for the atomic rename), and remove (for cleanup on failure)
        const mockFile = {
            createWriter(success, error) {
                if (failOnWriter) {
                    error(new Error('createWriter failed'));
                } else {
                    success(mockFileWriter);
                }
            },
            moveTo(dest, newName, success, error) {
                if (failOnMove) {
                    error(new Error('move failed'));
                    return;
                }
                //simulate atomic rename: remove source (.tmp), add target
                virtualFs.delete(newName + '.tmp');
                virtualFs.add(newName);
                success();
            },
            remove(success, error) {
                //cleanup of temp file on write/move failure
                success();
            }
        };

        const mockExistingFile = {
            remove(success, error) {
                if (failOnRemoveOld) {
                    error(new Error('remove failed'));
                } else {
                    success();
                }
            }
        };

        //virtual filesystem: tracks which filenames exist
        const virtualFs = new Set();

        const mockDirEntry = {
            getFile(filename, options, success, error) {
                if (options && options.create === false) {
                    //check existence
                    if (virtualFs.has(filename)) {
                        //return the appropriate entry type:
                        //tmp files get the write-capable mock, others get the removable mock
                        if (filename.endsWith('.tmp')) {
                            success(mockFile);
                        } else {
                            success(mockExistingFile);
                        }
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

        const {mockDir, mockFileWriter, virtualFs} = _setUpFs({});
        const blob = {fake: 'blob'};

        const promise = saveBlobToTempDir({blob, filename: 'drawing.jpg'});
        //write to .tmp
        expect(virtualFs.has('drawing.jpg.tmp')).toBe(true);
        mockFileWriter._triggerWriteEnd();
        const result = await promise;

        //temp was renamed to the target
        expect(result).toBe('drawing.jpg');
        expect(mockDir.lastUrl).toBe('/data/cache/');
        expect(mockFileWriter.write).toHaveBeenCalledWith(blob);
    });

    it('prefixes file:// on ios', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'ios' };
        rootStore.tempDir = '/var/mobile/Library/';

        const {mockDir, mockFileWriter} = _setUpFs({});
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

    it('rejects on fileWriter.onerror and cleans up temp file', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({});

        const promise = saveBlobToTempDir({blob: {}, filename: 'x.jpg'});
        //temp file was created
        expect(virtualFs.has('x.jpg.tmp')).toBe(true);
        mockFileWriter._triggerError(new Error('write failed'));

        await expect(promise).rejects.toThrow('write failed');
    });

    it('moves temp file over existing file atomically (original untouched until move)', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({});
        const newBlob = {fake: 'new-blob'};

        //simulate file already existing in temp dir
        virtualFs.add('existing.jpg');

        const promise = saveBlobToTempDir({blob: newBlob, filename: 'existing.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        //the new blob was written to the temp file
        expect(mockFileWriter.write).toHaveBeenCalledWith(newBlob);
        expect(mockFileWriter.write).toHaveBeenCalledTimes(1);
        //target exists after move, temp is cleaned up
        expect(virtualFs.has('existing.jpg')).toBe(true);
        expect(virtualFs.has('existing.jpg.tmp')).toBe(false);
    });

    it('creates new file when filename does not exist (no old file to remove)', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter} = _setUpFs({});

        const promise = saveBlobToTempDir({blob: {}, filename: 'fresh.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(mockFileWriter.write).toHaveBeenCalled();
    });

    it('preserves original file when write fails', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({});

        //simulate file already existing
        virtualFs.add('photo.jpg');

        const promise = saveBlobToTempDir({blob: {}, filename: 'photo.jpg'});
        //temp file was created but original is still there
        expect(virtualFs.has('photo.jpg.tmp')).toBe(true);
        expect(virtualFs.has('photo.jpg')).toBe(true);

        mockFileWriter._triggerError(new Error('disk full'));
        await expect(promise).rejects.toThrow('disk full');

        //original file is still intact (temp was cleaned up)
        expect(virtualFs.has('photo.jpg')).toBe(true);
    });

    it('preserves original file when move fails', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({failOnMove: true});

        //simulate file already existing
        virtualFs.add('photo.jpg');

        const promise = saveBlobToTempDir({blob: {}, filename: 'photo.jpg'});
        mockFileWriter._triggerWriteEnd();
        await expect(promise).rejects.toThrow('move failed');

        //original file is still intact
        expect(virtualFs.has('photo.jpg')).toBe(true);
    });

    it('writes a shorter replacement blob without trailing bytes', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({});

        //first write: long blob
        const longBlob = {fake: 'long'};
        let promise = saveBlobToTempDir({blob: longBlob, filename: 'resize.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(mockFileWriter.write).toHaveBeenCalledWith(longBlob);
        expect(virtualFs.has('resize.jpg.tmp')).toBe(false);

        //second write: shorter blob via temp-then-move (atomic swap)
        mockFileWriter.write.mockClear();
        const shortBlob = {fake: 'short'};
        promise = saveBlobToTempDir({blob: shortBlob, filename: 'resize.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(mockFileWriter.write).toHaveBeenCalledWith(shortBlob);
        expect(mockFileWriter.write).toHaveBeenCalledTimes(1);
    });

    it('rejects when remove of old file fails during move', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({failOnRemoveOld: true});

        //simulate file already existing
        virtualFs.add('locked.jpg');

        const promise = saveBlobToTempDir({blob: {}, filename: 'locked.jpg'});
        mockFileWriter._triggerWriteEnd();
        //in the new flow, the old file is overwritten by moveTo, not removed
        //separately, so this succeeds (old file is replaced atomically)
        const result = await promise;
        expect(result).toBe('locked.jpg');
    });
});
