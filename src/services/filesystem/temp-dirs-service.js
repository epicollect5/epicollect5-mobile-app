import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {utilsService} from '@/services/utilities/utils-service';
import {moveFileService} from '@/services/filesystem/move-file-service';

export const tempDirsService = {

    createTemporaryDir() {
        const rootStore = useRootStore();
        const device = rootStore.device;
        let path = '';
        //request temporary folder from file system based on platform
        return new Promise((resolve, reject) => {

            if (device.platform === PARAMETERS.WEB) {
                resolve(path);
            }

            if (device.platform === PARAMETERS.IOS) {
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + PARAMETERS.TEMP_DIR, function (the_file_system) {
                    path = the_file_system.nativeURL;

                    console.log(path);

                    /* We need to provide the full path to the tmp folder to record an audio file
                     *
                     * iOS 7+ does not want 'file://' in the path to record an audio file
                     *
                     * if the path starts with 'file://', error thrown is
                     * 'Failed to start recording using AvAudioRecorder'
                     * so it is removed using slice(7);
                     */
                    path = path.slice(7);
                    resolve(path);

                }, function (error) {
                    console.log(JSON.stringify(error));
                    reject();
                });
            }

            if (device.platform === PARAMETERS.ANDROID) {
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + PARAMETERS.TEMP_DIR, function (the_file_system) {
                    path = the_file_system.nativeURL;
                    resolve(path);
                }, function (error) {
                    console.log(JSON.stringify(error));
                    reject();
                });
            }
        });
    },

    async clearTemporaryDir() {
        return new Promise((resolve, reject) => {

                function _onError(error) {
                    console.error(error);
                    reject(error);
                }

                const rootStore = useRootStore();
                const device = rootStore.device;
                const tempFolderPath = rootStore.tempDir;

                if (device.platform === PARAMETERS.WEB) {
                    resolve();
                }

                console.log('Clearing temp folder at ->', tempFolderPath);
                //imp: ios needs the file:// protocol
                const protocol = (rootStore.device.platform === PARAMETERS.IOS) ? utilsService.getProtocol(tempFolderPath) : '';
                window.resolveLocalFileSystemURL(protocol + tempFolderPath, function (tempFolder) {
                    const reader = tempFolder.createReader();
                    reader.readEntries(function (entries) {
                        if (entries.length === 0) {
                            console.log('No files to delete in the temporary folder.');
                        } else {
                            entries.forEach(function (entry) {
                                entry.remove(function () {
                                    console.log('File removed: ' + entry.fullPath);
                                }, _onError);
                            });
                        }
                        resolve();
                    }, _onError);
                }, _onError);
            }
        );
    }
};