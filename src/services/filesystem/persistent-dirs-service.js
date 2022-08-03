
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