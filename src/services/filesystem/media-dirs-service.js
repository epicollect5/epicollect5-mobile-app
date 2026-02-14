import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {Filesystem, Directory} from '@capacitor/filesystem';
import {utilsService} from '@/services/utilities/utils-service';

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
    createDirsLegacy() {
        const rootStore = useRootStore();
        const device = rootStore.device;
        const dirs = [
            PARAMETERS.PHOTO_DIR,
            PARAMETERS.AUDIO_DIR,
            PARAMETERS.VIDEO_DIR,
            PARAMETERS.LOGOS_DIR,
            PARAMETERS.TEMP_DIR
        ];

        if (device.platform === PARAMETERS.WEB) {
            //todo: for now on the web we just return
            return true;
        }

        //create the folder on the file system recursively
        return new Promise((resolve, reject) => {

            let entry;

            function _onCreateSuccess(dir) {
                if (dir.isDirectory) {
                    console.log('Folder ' + dir.name + ' already exists, skipping.');
                } else {
                    console.log('Folder ' + dir.name + ' created.');
                }
                _createMediaDir();
            }

            function _createMediaDir() {
                let mediaDir;
                if (dirs.length > 0) {

                    mediaDir = dirs.shift();

                    //create a media folder: images, audios, videos, logo, cache
                    entry.getDirectory(mediaDir, {
                        create: true,
                        exclusive: false
                    }, _onCreateSuccess, _onError);
                } else {
                    console.log('All media folders created (or skipped)');
                    resolve();
                }
            }

            function _onSuccess(fileSystem) {
                entry = fileSystem;
                //create media folders recursively
                _createMediaDir();
            }

            function _onError(error) {
                console.log(error);
                reject();
            }

            //get handle of 'data/data/<package_name>/files/' on Android, or Library folder on iOS
            console.log('Persistent Storage: ' + cordova.file.dataDirectory);
            window.resolveLocalFileSystemURL(cordova.file.dataDirectory, _onSuccess, _onError);
        });
    },

    /**
     * Resolves the path for user-visible exported media.
     * iOS: App data is grouped by the OS under the App Name.
     * Android: We manually group projects under an 'Epicollect5' folder.
     */
    getExportMediaPath(projectSlug) {
        const rootStore = useRootStore();
        const platform = rootStore.device.platform;
        const cleanSlug = projectSlug.replace(/^\/|\/$/g, '');

        if (platform === PARAMETERS.ANDROID) {
            // Results in 'Epicollect5/project-slug'
            return PARAMETERS.APP_NAME + '/' + cleanSlug;
        }

        // Results in 'project-slug' (iOS creates the 'Epicollect5' folder automatically)
        return cleanSlug;
    },

    async removeExternalMediaDirs(projectSlug) {
        const documentsFolder = utilsService.getPlatformDocumentsFolder();
        if (!documentsFolder) {
            return true;
        }

        const baseMediaPath = this.getExportMediaPath(projectSlug);

        const mediaDirs = [
            PARAMETERS.PHOTO_DIR,
            PARAMETERS.AUDIO_DIR,
            PARAMETERS.VIDEO_DIR
        ];

        let allSucceeded = true;
        for (const dir of mediaDirs) {
            try {
                const cleanDir = dir.replace(/\//g, '');
                const fullPath = baseMediaPath + '/' + cleanDir;

                await Filesystem.rmdir({
                    path: fullPath,
                    directory: documentsFolder,
                    recursive: true
                });
            } catch (error) {
                if (error.message && !error.message.includes('not exist')) {
                    allSucceeded = false;
                }
            }
        }
        return allSucceeded;
    },

    //check if a directory exists
    async dirExists(absolutePath) {
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
    },

    getRelativeDataDirectoryForCapacitorFilesystem() {
        const rootStore = useRootStore();

        /**
         * ANDROID MAPPING:
         * In Cordova, 'cordova.file.dataDirectory' points to the internal
         * app-specific folder (usually /data/user/0/package/files).
         * In Capacitor, 'Directory.Data' is the direct equivalent.
         */
        if (rootStore.device.platform === PARAMETERS.ANDROID) {
            return Directory.Data;
        }

        /**
         * IOS MAPPING:
         * This is where the platforms diverge.
         * In Cordova, 'cordova.file.dataDirectory' typically points to 'Library/NoCloud'.
         * In Capacitor, using 'Directory.Data' would incorrectly point to 'Documents'.
         * 'Directory.LibraryNoCloud' is the precise match for the old Cordova storage
         * location, ensuring the Filesystem plugin looks in the private Library
         * sandbox instead of the public Documents sandbox.
         */
        if (rootStore.device.platform === PARAMETERS.IOS) {
            return Directory.LibraryNoCloud;
        }

        // If we reach this point, it means we are not on a native platform
        console.warn('Unsupported platform for Capacitor filesystem directory resolution');
        return null;
    }
};
