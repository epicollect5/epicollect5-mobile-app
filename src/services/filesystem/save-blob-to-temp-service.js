import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';

export const saveBlobToTempDir = ({blob, filename}) => {
    const rootStore = useRootStore();

    return new Promise((resolve, reject) => {
        if (rootStore.device.platform === PARAMETERS.WEB) {
            reject(new Error('Cannot save blob to temp dir on web'));
            return;
        }

        if (!blob || !filename) {
            reject(new Error('Missing blob or filename'));
            return;
        }

        //imp: ios needs the 'file://' protocol prefix for resolveLocalFileSystemURL
        const protocol = rootStore.device.platform === PARAMETERS.IOS ? 'file://' : '';
        const tempDir = rootStore.tempDir;

        //imp: write to a temp file, back up the original, then move the temp
        //into place. Cordova File 6.0.2's iOS moveTo removes the destination
        //before calling moveItemAtPath; if that system call fails, both the
        //original and the temp are gone. The .bak copy lets us restore the
        //original when the move fails, so the answer never points at a
        //missing file.
        const tmpFilename = filename + '.tmp';
        const bakFilename = filename + '.bak';

        const cleanupBak = function (cb) {
            dir.getFile(bakFilename, {create: false}, function (bakEntry) {
                bakEntry.remove(cb, cb);
            }, cb);
        };

        const writeBlob = function (file) {
            file.createWriter(function (fileWriter) {
                //imp: do not move from onwriteend. It also fires after a
                //failed write, so moveTemp could race the .tmp removal in
                //onerror and install partial data over the original photo.
                //Move only after a confirmed-successful write, gated on
                //the lack of an onerror.
                let writeFailed = false;
                fileWriter.onwriteend = function () {
                    if (writeFailed) {
                        return;
                    }
                    moveTemp();
                };
                fileWriter.onerror = function (error) {
                    writeFailed = true;
                    //write failed: clean up the temp file, original is untouched
                    file.remove(function () {
                        reject(error);
                    }, function () {
                        reject(error);
                    });
                };
                fileWriter.write(blob);
            }, function (error) {
                reject(error);
            });
        };

        const moveTemp = function () {
            dir.getFile(tmpFilename, {create: false}, function (tmpEntry) {
                dir.getFile(filename, {create: false}, function (existingEntry) {
                    //target exists: back it up before the move, so we can
                    //restore it if iOS's moveTo deletes the destination and
                    //then fails. Clear any stale backup first (e.g. kept by
                    //a failed restore below): copyTo cannot overwrite, so a
                    //leftover would reject every later save for this photo
                    cleanupBak(function () {
                        dir.getFile(bakFilename, {create: true}, function (bakEntry) {
                            existingEntry.copyTo(dir, bakFilename, function () {
                                //backup created: attempt the move
                                tmpEntry.moveTo(dir, filename, function () {
                                    //move succeeded: remove the backup
                                    cleanupBak(function () {
                                        resolve(filename);
                                    });
                                }, function (error) {
                                    //move failed: restore original from backup
                                    bakEntry.moveTo(dir, filename, function () {
                                        cleanupBak(function () {
                                            reject(error);
                                        });
                                    }, function () {
                                        //restore also failed: keep the .bak in
                                        //place (it is the only remaining
                                        //recoverable copy) and reject; the next
                                        //save clears the stale backup first
                                        reject(error);
                                    });
                                });
                            }, function (error) {
                                //copyTo failed: reject to preserve the original;
                                //attempting moveTo without backup risks losing both
                                //the original and the temp on iOS
                                tmpEntry.remove(function () {
                                    reject(error);
                                }, function () {
                                    reject(error);
                                });
                            });
                        }, function (error) {
                            reject(error);
                        });
                    });
                }, function () {
                    //target does not exist yet: move creates it (no backup needed)
                    tmpEntry.moveTo(dir, filename, function () {
                        resolve(filename);
                    }, function (error) {
                        tmpEntry.remove(function () {
                            reject(error);
                        }, function () {
                            reject(error);
                        });
                    });
                });
            }, function (error) {
                reject(error);
            });
        };

        const dir = {};
        window.resolveLocalFileSystemURL(
            protocol + tempDir,
            function (resolvedDir) {
                Object.assign(dir, resolvedDir);
                dir.getFile(tmpFilename, {create: true}, function (file) {
                    writeBlob(file);
                }, function (error) {
                    reject(error);
                });
            },
            function (error) {
                reject(error);
            }
        );
    });
};
