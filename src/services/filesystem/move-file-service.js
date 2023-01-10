/*
 /*
 * Move the video file from sd card folder (real or emulated) t
 * o app cache folder changing the file name to the current timestamp
 * (video extension will be always .mp4)
 */

import { useRootStore } from '@/stores/root-store';
import { PARAMETERS, DEMO_PROJECT } from '@/config';
import { utilsService } from '@/services/utilities/utils-service';
import { Capacitor } from '@capacitor/core';

export const moveFileService = {
    //add 'file://' protocol if it is missing in the URI
    getProtocol (uri) {

        let protocol;

        if (uri.indexOf('file://') > -1) {
            //file:// is already there, return empty protocol
            protocol = '';
        }
        else {
            protocol = 'file://';
        }
        return protocol;
    },

    //imp:maybe this is nit need with latest cordova as they changed where to save files
    moveVideoToCache (video_URI, filename) {

        const rootStore = useRootStore();
        return new Promise((resolve, reject) => {
            let protocol = '';

            function _onError (error) {
                console.log(error);
                reject(error);
            }

            function _onSuccess (video_file_entry) {
                function _gotFS (filesystem) {
                    //move video file from its directory to app cache directory with new name)
                    video_file_entry.moveTo(filesystem, filename, function (success) {
                        console.log(success);
                        resolve();
                    }, _onError);
                }

                //request temporary folder from file system
                //request temporary folder from file system
                switch (rootStore.device.platform) {
                    case PARAMETERS.ANDROID:
                        window.resolveLocalFileSystemURL(cordova.file.cacheDirectory, _gotFS, _onError);
                        break;
                    case PARAMETERS.IOS:
                        window.resolveLocalFileSystemURL(cordova.file.tempDirectory, _gotFS, _onError);
                        break;
                }
            }

            //on iOS, cordova needs the 'file://' protocol if it is not there
            protocol = (rootStore.device.platform === PARAMETERS.IOS) ? this.getProtocol(video_URI) : '';

            //get file entry resolving video full path (wherever is was saved)
            window.resolveLocalFileSystemURL(protocol + video_URI, _onSuccess, _onError);
        });
    },

    moveToAppTemporaryDir (file_URI, filename) {
        const rootStore = useRootStore();
        return new Promise((resolve, reject) => {
            const protocol = '';

            function _onError (error) {
                console.log(error);
                reject(error);
            }

            function _onSuccess (file_entry) {
                function _gotFS (filesystem) {
                    //move video file from its directory to app cache directory with new name)
                    file_entry.moveTo(filesystem, filename, function (success) {
                        console.log(success);
                        resolve();
                    }, _onError);
                }
                //request temporary folder from file system
                switch (rootStore.device.platform) {
                    case PARAMETERS.ANDROID:
                        window.resolveLocalFileSystemURL(cordova.file.cacheDirectory, _gotFS, _onError);
                        break;
                    case PARAMETERS.IOS:
                        window.resolveLocalFileSystemURL(cordova.file.tempDirectory, _gotFS, _onError);
                        break;
                }
            }

            //imp: only if android 11+
            if (rootStore.device.platform === PARAMETERS.ANDROID) {
                //todo: check this
                // if (parseInt(rootStore.device.osVersion) >= 11) {
                //     window.resolveLocalFileSystemURL(protocol + file_URI, function (f) {
                //         f.filesystem.root.getFile(f.fullPath, {}, _onSuccess, _onError);
                //     }, _onError);

                // }
                // else {
                //get file entry resolving video full path (wherever is was saved)
                window.resolveLocalFileSystemURL(file_URI, _onSuccess, _onError);
                // }
            }

            if (rootStore.device.platform === PARAMETERS.IOS) {
                //get file entry resolving video full path (wherever is was saved)
                //imp:    //ios needs the protocol to resolve a local file
                window.resolveLocalFileSystemURL(this.getProtocol(file_URI) + file_URI, _onSuccess, _onError);
            }
        });
    },

    //move media file
    moveToAppPrivateDir (file_URI, filename, media_type, project_ref) {
        const rootStore = useRootStore();
        return new Promise((resolve, reject) => {
            const media_dir = utilsService.getFilePath(media_type);

            function _onError (error) {
                console.log(error);
                reject(error);
            }

            function _onSuccess (file_entry) {
                function _gotFS (filesystem) {
                    //create project folder if not exists
                    //create new project directory (if not exits)
                    filesystem.getDirectory(project_ref, {
                        create: true,
                        exclusive: false
                    }, _onCreateProjectDirectorySuccess, _onError);

                    function _onCreateProjectDirectorySuccess () {

                        //move video file from its directory to app cache directory with new name)
                        file_entry.moveTo(filesystem, '/' + project_ref + '/' + filename, function (success) {
                            console.log(success);
                            resolve();
                        }, _onError);
                    }
                }
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + media_dir, _gotFS, _onError);
            }
            //ios needs the protocol to resolve a local file
            const protocol = (rootStore.device.platform === PARAMETERS.IOS) ? this.getProtocol(file_URI) : '';

            //get file entry resolving file full path (wherever is was saved)
            window.resolveLocalFileSystemURL(protocol + file_URI, _onSuccess, _onError);
        });
    },

    //copy logo img for demo project from assets/www - > READ ONLY, so we cannot move but just copy https://goo.gl/e7D3MU
    copyDemoProjectLogoToPrivateDir () {

        const rootStore = useRootStore();
        const project_ref = DEMO_PROJECT.PROJECT_REF;
        const media_dir = PARAMETERS.LOGOS_DIR;
        const stored_filename = DEMO_PROJECT.PROJECT_LOGO_STORED_FILENAME;
        const filename = DEMO_PROJECT.PROJECT_LOGO_IMG_FILENAME;

        return new Promise((resolve, reject) => {
            function _onError (error) {
                console.log(error);
                reject(error);
            }

            function _onSuccess (file_entry) {
                function _gotFS (filesystem) {
                    //create project folder if not exists
                    filesystem.getDirectory(project_ref, {
                        create: true,
                        exclusive: false
                    }, _onCreateProjectDirectorySuccess, _onError);

                    function _onCreateProjectDirectorySuccess () {
                        //copy file from www directory to app private directory with new name
                        file_entry.copyTo(filesystem, project_ref + '/' + stored_filename, function (success) {
                            console.log(success);
                            resolve();
                        }, _onError);
                    }
                }

                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + media_dir, _gotFS, _onError);
            }

            if (rootStore.device.platform !== PARAMETERS.WEB) {

                //todo: check this
                let logo_img_URI = cordova.file.applicationDirectory + 'www/assets/images';
                const protocol = '';

                //ios needs the protocol to resolve a local file
                //   protocol = (rootStore.device.platform === PARAMETERS.IOS) ? this.getProtocol(logo_img_URI) : '';

                //get file entry resolving file full path (wherever is was saved)
                if (rootStore.device.platform === PARAMETERS.IOS) {
                    //Capacitor.convertFileSrc

                    console.log('capacitor -> ' + Capacitor.convertFileSrc(protocol + logo_img_URI + filename));
                    // logo_img_URI = logo_img_URI.replace('file://', 'cdvfile://');

                    logo_img_URI = Capacitor.convertFileSrc(logo_img_URI);

                    window.resolveLocalFileSystemURL((logo_img_URI + filename), _onSuccess, _onError);
                }
                else {
                    window.resolveLocalFileSystemURL(protocol + logo_img_URI + filename, _onSuccess, _onError);
                }
            } else {
                // If web, resolve
                resolve();
            }
        });
    }
};
