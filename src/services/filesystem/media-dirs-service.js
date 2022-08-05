import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { Filesystem, Directory } from '@capacitor/filesystem';
import * as services from '@/services';

export const mediaDirsService = {

    //Cannot use Capacitor Filesystem for backward compatibility
    //This method is here only for reference
    //imp: this works on Android but it might break app updates
    //imp: on iOS it creates the folders under Documents instead of Library/NoClouds
    // createDirs () {

    //     const rootStore = useRootStore();
    //     const device = rootStore.device;
    //     const dirs = [
    //         PARAMETERS.PHOTO_DIR,
    //         PARAMETERS.AUDIO_DIR,
    //         PARAMETERS.VIDEO_DIR,
    //         PARAMETERS.LOGOS_DIR
    //     ];

    //     if (device.platform === PARAMETERS.WEB) {
    //         //todo: for now on the web we just return
    //         return true;
    //     }

    //     async function _createMediaDirectory (dir) {
    //         try {
    //             await Filesystem.mkdir({
    //                 path: dir,
    //                 directory: Directory.Data,
    //                 recursive: false // like mkdir -p
    //             });
    //         } catch (e) {
    //             console.log('Unable to make directory', e);
    //             return false;
    //         }
    //     }

    //     //if folders are already created, resolve immediately
    //     if (window.localStorage.is_app_already_installed) {
    //         console.log('---App already installed -> skip media dir creation');
    //         return true;
    //     }

    //     //get handle of 'data/data/<package_name>/files/' on Android, or Library folder on iOS
    //     console.log('Persistent Storage -> ' + Directory.Data);

    //     dirs.forEach((dir) => {
    //         _createMediaDirectory(dir);
    //     });

    //     return true;
    // },

    //uses Cordova filesystem plugin
    createDirsLegacy () {
        const rootStore = useRootStore();
        const device = rootStore.device;
        const dirs = [
            PARAMETERS.PHOTO_DIR,
            PARAMETERS.AUDIO_DIR,
            PARAMETERS.VIDEO_DIR,
            PARAMETERS.LOGOS_DIR
        ];

        if (device.platform === PARAMETERS.WEB) {
            //todo: for now on the web we just return
            return true;
        }

        //create the folder on the fyle system recursively
        return new Promise((resolve, reject) => {

            let entry;

            function _onCreateSuccess () {
                _createMediaDir();
            }

            function _createMediaDir () {
                let media_dir;
                if (dirs.length > 0) {

                    media_dir = dirs.shift();

                    //create a media folder: images, audios, videos
                    entry.getDirectory(media_dir, {
                        create: true,
                        exclusive: false
                    }, _onCreateSuccess, _onError);
                }
                else {
                    console.log('Media folders created');
                    resolve();
                }
            }

            function _onSuccess (fileSystem) {
                entry = fileSystem;
                //create media folders recursively
                _createMediaDir();
            }

            function _onError (error) {
                console.log(error);
                reject();
            }

            //if folders are already created, resolve immediately
            if (window.localStorage.is_app_already_installed) {
                console.log('---App already installed -> skip media dir creation');
                resolve();
            }
            else {
                //get handle of 'data/data/<package_name>/files/' on Android, or Library folder on iOS
                console.log('Persistent Storage: ' + cordova.file.dataDirectory);
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory, _onSuccess, _onError);
            }
        });
    },
    async removeExternalMediaDirs (projectSlug) {

        const self = this;
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].language;
        const downloadFolder = services.utilsService.getPlatformDownloadFolder();
        const photoDirDestination =
            downloadFolder + projectSlug + '/' + PARAMETERS.PHOTO_DIR;
        const audioDirDestination =
            downloadFolder + projectSlug + '/' + PARAMETERS.AUDIO_DIR;
        const videoDirDestination =
            downloadFolder + projectSlug + '/' + PARAMETERS.VIDEO_DIR;

        //find out if folders exist
        const externalStorage = cordova.file.externalRootDirectory;
        const dirExistsPhoto = await self.dirExists(externalStorage + photoDirDestination);
        const dirExistsAudio = await self.dirExists(externalStorage + audioDirDestination);
        const dirExistsVideo = await self.dirExists(externalStorage + videoDirDestination);

        return new Promise((resolve, reject) => {
            (async function () {

                //any errors bail out
                if (dirExistsPhoto === null || dirExistsAudio === null || dirExistsVideo === null) {
                    reject(labels.unknown_error);
                }

                try {
                    //remove photo dir (if exists)
                    if (dirExistsPhoto) {
                        await Filesystem.rmdir({
                            path: photoDirDestination,
                            directory: Directory.ExternalStorage,
                            recursive: true
                        });
                    }
                    //remove audio dir (if exists)
                    if (dirExistsAudio) {
                        await Filesystem.rmdir({
                            path: audioDirDestination,
                            directory: Directory.ExternalStorage,
                            recursive: true
                        });
                    }
                    //remove video dir (if exists)
                    if (dirExistsVideo) {
                        await Filesystem.rmdir({
                            path: videoDirDestination,
                            directory: Directory.ExternalStorage,
                            recursive: true
                        });
                    }
                    resolve();
                }
                catch (error) {
                    console.log(error);
                    resolve();
                }
            }());
        });
    },
    //check if a directory exists
    async dirExists (absolutePath) {
        return new Promise((resolve) => {
            window.resolveLocalFileSystemURL(
                absolutePath,
                (dir) => {
                    console.log(dir);
                    resolve(true);
                }, (error) => {
                    console.log(error);
                    //if error code is 1, folder not found.
                    error.code === 1 ? resolve(false) : resolve(null);
                });
        });
    }
};
