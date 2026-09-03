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

        //imp: when the same filename already exists we remove and recreate
        //the file before writing. Cordova's FileWriter.write writes at the
        //current offset (truncated to 0 by the spec on open, but trailing
        //bytes have been observed to persist on a shorter replacement).
        //Replacing the entry guarantees the on-disk length matches the
        //new blob with no leftover tail.
        const writeBlob = function (file) {
            file.createWriter(function (fileWriter) {
                fileWriter.onwriteend = function () {
                    resolve(filename);
                };
                fileWriter.onerror = function (error) {
                    reject(error);
                };
                fileWriter.write(blob);
            }, function (error) {
                reject(error);
            });
        };

        const createNew = function () {
            dir.getFile(filename, {create: true}, function (file) {
                writeBlob(file);
            }, function (error) {
                reject(error);
            });
        };

        const dir = {};
        window.resolveLocalFileSystemURL(
            protocol + tempDir,
            function (resolvedDir) {
                Object.assign(dir, resolvedDir);
                resolvedDir.getFile(filename, {create: false}, function (existing) {
                    existing.remove(function () {
                        createNew();
                    }, function (error) {
                        reject(error);
                    });
                }, function () {
                    //NOT_FOUND (or anything else): nothing to remove
                    createNew();
                });
            },
            function (error) {
                reject(error);
            }
        );
    });
};
