
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';

export const persistentDirsService = {

    async execute () {
        const rootStore = useRootStore();
        const device = rootStore.device;
        let path = '';
        //request persistent folder from file system based on platform
        return new Promise((resolve, reject) => {

            if (device.platform === PARAMETERS.WEB) {
                resolve(path);
            }

            if (device.platform === PARAMETERS.IOS) {
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, (fileSystem) => {
                    path = fileSystem.nativeURL;


                    /* We need to provide the full path to the tmp folder to record/play an audio file
                    *
                    * iOS 7+ does not want 'file://' in the path to record/play an audio file
                    *
                    * if the path starts with 'file://', error thrown is
                    * 'Failed to start recording using AvAudioRecorder'
                    * so it is removed using slice(7);
                    */
                    if (path.startsWith('file://')) {
                        path = path.slice(7);
                    }
                    resolve(path);
                }, (error) => {
                    console.log(JSON.stringify(error));
                    reject();
                });
            }

            if (device.platform === PARAMETERS.ANDROID) {
                //Android only getting public cache directory
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, (fileSystem) => {
                    path = fileSystem.nativeURL;
                    resolve(path);
                }, (error) => {
                    console.log(JSON.stringify(error));
                    reject();
                });
            }
        });
    }
};