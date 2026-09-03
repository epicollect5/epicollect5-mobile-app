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

        //imp: write to a temp file first, then atomically move it into place.
        //This avoids two failure modes of remove-then-create:
        //  1. the original is deleted before the replacement is written, so a
        //     write failure leaves no file to roll back to
        //  2. Cordova's FileWriter has been observed to leave trailing bytes
        //     on a shorter replacement when the file is reused in place
        //moveTo overwrites the target atomically when it already exists, so
        //the original stays on disk until the replacement is confirmed.
        const tmpFilename = filename + '.tmp';

        const writeBlob = function (file) {
            file.createWriter(function (fileWriter) {
                fileWriter.onwriteend = function () {
                    //write succeeded: move the temp file into place
                    moveTemp();
                };
                fileWriter.onerror = function (error) {
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
                    //target exists: move overwrites it atomically
                    tmpEntry.moveTo(dir, filename, function () {
                        resolve(filename);
                    }, function (error) {
                        //move failed: clean up temp, original is untouched
                        tmpEntry.remove(function () {
                            reject(error);
                        }, function () {
                            reject(error);
                        });
                    });
                }, function () {
                    //target does not exist yet: move creates it
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
                //write to the temp filename; the original is untouched until
                //moveTemp atomically replaces it
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
