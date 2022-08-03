
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';

export const tempDirsService = {

    execute () {
        const rootStore = useRootStore();
        const device = rootStore.device;
        let path = '';
        //request temporary folder from file system based on platform
        return new Promise((resolve, reject) => {

            if (device.platform === PARAMETERS.WEB) {
                resolve(path);
            }

            if (device.platform === PARAMETERS.IOS) {
                window.resolveLocalFileSystemURL(cordova.file.tempDirectory, function (the_file_system) {

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
                //Android only getting private cache directory (Android 11 fix) 
                window.resolveLocalFileSystemURL(cordova.file.cacheDirectory, function (the_file_system) {
                    path = the_file_system.nativeURL;
                    resolve(path);
                }, function (error) {
                    console.log(JSON.stringify(error));
                    reject();
                });
            }
        });
    }
};