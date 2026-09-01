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

        window.resolveLocalFileSystemURL(
            protocol + tempDir,
            function (dir) {
                dir.getFile(filename, {create: true}, function (file) {
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
