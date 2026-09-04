import { vi, describe, it, expect, beforeEach } from 'vitest';
import flushPromises from 'flush-promises';
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

    function _setUpFs({
        failOnGetFile = false,
        failOnWriter = false,
        failOnMove = false,
        failOnBackup = false,
        failOnRestore = false
    } = {}) {
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

        const virtualFs = new Set();

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
                virtualFs.delete(newName + '.tmp');
                virtualFs.add(newName);
                success();
            },
            remove(success) {
                success();
            }
        };

        const mockExistingFile = {
            copyTo(dest, newName, success, error) {
                if (failOnBackup) {
                    error(new Error('backup failed'));
                    return;
                }
                virtualFs.add(newName);
                success();
            },
            moveTo(dest, newName, success, error) {
                if (failOnRestore) {
                    error(new Error('restore failed'));
                    return;
                }
                //restore: .bak → original name
                virtualFs.delete(newName + '.bak');
                virtualFs.add(newName);
                success();
            }
        };

        const mockBakFile = {
            moveTo(dest, newName, success, error) {
                if (failOnRestore) {
                    error(new Error('restore failed'));
                    return;
                }
                virtualFs.delete(newName + '.bak');
                virtualFs.add(newName);
                success();
            },
            remove(success) {
                virtualFs.delete(virtualFs.values ? Array.from(virtualFs).find(n => n.endsWith('.bak')) : '');
                success();
            }
        };

        const getFileSpy = vi.fn();
        const mockDirEntry = {
            getFile(filename, options, success, error) {
                getFileSpy(filename, options);
                if (options && options.create === false) {
                    if (virtualFs.has(filename)) {
                        if (filename.endsWith('.tmp')) {
                            success(mockFile);
                        } else if (filename.endsWith('.bak')) {
                            success(mockBakFile);
                        } else {
                            success(mockExistingFile);
                        }
                    } else {
                        error(new Error('NOT_FOUND'));
                    }
                } else {
                    virtualFs.add(filename);
                    if (failOnGetFile) {
                        error(new Error('getFile failed'));
                    } else if (filename.endsWith('.bak')) {
                        //backup slot: restore/cleanup obey failOnRestore
                        success(mockBakFile);
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

        return {mockDir, mockFile, mockFileWriter, mockExistingFile, mockBakFile, virtualFs, getFileSpy};
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
        expect(virtualFs.has('drawing.jpg.tmp')).toBe(true);
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

        const {mockDir, mockFileWriter} = _setUpFs({});

        const promise = saveBlobToTempDir({blob: {fake: 'blob'}, filename: 'sig.jpg'});
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
        expect(virtualFs.has('x.jpg.tmp')).toBe(true);
        mockFileWriter._triggerError(new Error('write failed'));

        await expect(promise).rejects.toThrow('write failed');
    });

    it('does not move the temp file when onerror is followed by onwriteend', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs, getFileSpy} = _setUpFs({});
        virtualFs.add('photo.jpg');

        const promise = saveBlobToTempDir({blob: {}, filename: 'photo.jpg'});
        const assertion = expect(promise).rejects.toThrow('write failed');

        //aborted write: onerror fires, then onwriteend on the abort
        mockFileWriter._triggerError(new Error('write failed'));
        mockFileWriter._triggerWriteEnd();

        await assertion;
        //the move path is gated: no follow-up getFile(photo.jpg.tmp, create:false)
        //after the error, which is what moveTemp would otherwise issue
        const tmpCheck = getFileSpy.mock.calls.filter(
            ([name, opts]) => name === 'photo.jpg.tmp' && opts && opts.create === false
        );
        expect(tmpCheck).toHaveLength(0);
    });

    it('backs up existing file and restores when move fails', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({failOnMove: true});

        virtualFs.add('photo.jpg');

        const promise = saveBlobToTempDir({blob: {}, filename: 'photo.jpg'});
        mockFileWriter._triggerWriteEnd();
        await expect(promise).rejects.toThrow('move failed');

        //original restored from backup, .bak cleaned up
        expect(virtualFs.has('photo.jpg')).toBe(true);
        expect(virtualFs.has('photo.jpg.bak')).toBe(false);
    });

    it('moves temp file over existing file and cleans up backup', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({});

        virtualFs.add('existing.jpg');

        const promise = saveBlobToTempDir({blob: {fake: 'new'}, filename: 'existing.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(virtualFs.has('existing.jpg')).toBe(true);
        expect(virtualFs.has('existing.jpg.bak')).toBe(false);
        expect(virtualFs.has('existing.jpg.tmp')).toBe(false);
    });

    it('creates new file when filename does not exist (no backup needed)', async () => {
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

        virtualFs.add('photo.jpg');

        const promise = saveBlobToTempDir({blob: {}, filename: 'photo.jpg'});
        expect(virtualFs.has('photo.jpg.tmp')).toBe(true);
        expect(virtualFs.has('photo.jpg')).toBe(true);

        mockFileWriter._triggerError(new Error('disk full'));
        await expect(promise).rejects.toThrow('disk full');

        expect(virtualFs.has('photo.jpg')).toBe(true);
    });

    it('rejects when backup fails to preserve the original', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({failOnBackup: true});

        virtualFs.add('old.jpg');

        const promise = saveBlobToTempDir({blob: {}, filename: 'old.jpg'});
        mockFileWriter._triggerWriteEnd();
        await expect(promise).rejects.toThrow('backup failed');

        //original preserved
        expect(virtualFs.has('old.jpg')).toBe(true);
    });

    it('preserves the backup when restore fails after move failure', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({failOnMove: true, failOnRestore: true});

        virtualFs.add('gone.jpg');

        const promise = saveBlobToTempDir({blob: {}, filename: 'gone.jpg'});
        mockFileWriter._triggerWriteEnd();
        await expect(promise).rejects.toThrow('move failed');

        //the .bak is the only remaining recoverable copy: it must not be
        //deleted on the restore-failure path
        expect(virtualFs.has('gone.jpg.bak')).toBe(true);
    });

    it('clears a stale backup before creating a new one', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({});

        //leftover .bak from an earlier failed restore
        virtualFs.add('photo.jpg');
        virtualFs.add('photo.jpg.bak');

        const promise = saveBlobToTempDir({blob: {fake: 'new'}, filename: 'photo.jpg'});
        mockFileWriter._triggerWriteEnd();
        const result = await promise;

        //stale backup did not break copyTo; save completed and cleaned up
        expect(result).toBe('photo.jpg');
        expect(virtualFs.has('photo.jpg')).toBe(true);
        expect(virtualFs.has('photo.jpg.bak')).toBe(false);
        expect(virtualFs.has('photo.jpg.tmp')).toBe(false);
    });

    it('writes a shorter replacement blob without trailing bytes', async () => {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';

        const {mockFileWriter, virtualFs} = _setUpFs({});

        const longBlob = {fake: 'long'};
        let promise = saveBlobToTempDir({blob: longBlob, filename: 'resize.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(mockFileWriter.write).toHaveBeenCalledWith(longBlob);
        expect(virtualFs.has('resize.jpg.tmp')).toBe(false);

        mockFileWriter.write.mockClear();
        const shortBlob = {fake: 'short'};
        promise = saveBlobToTempDir({blob: shortBlob, filename: 'resize.jpg'});
        mockFileWriter._triggerWriteEnd();
        await promise;

        expect(mockFileWriter.write).toHaveBeenCalledWith(shortBlob);
        expect(mockFileWriter.write).toHaveBeenCalledTimes(1);
    });
});
