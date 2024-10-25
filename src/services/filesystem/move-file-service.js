/*
 /*
 * Move the video file from sd card folder (real or emulated) t
 * o app cache folder changing the file name to the current timestamp
 * (video extension will be always .mp4)
 */

import {useRootStore} from '@/stores/root-store';
import {PARAMETERS, DEMO_PROJECT} from '@/config';
import {utilsService} from '@/services/utilities/utils-service';
import {Capacitor} from '@capacitor/core';
import {notificationService} from '@/services/notification-service';

export const moveFileService = {
    moveToAppTemporaryDir(sourcePathURL, filename) {
        const rootStore = useRootStore();
        return new Promise((resolve, reject) => {

            function _onError(error) {
                console.log(error);
                reject(error);
            }

            function _onSuccess(file_entry) {
                function _gotFS(filesystem) {
                    //move file from its directory to app cache directory with new name
                    file_entry.moveTo(filesystem, filename, function (success) {
                        console.log(success);
                        resolve();
                    }, _onError);
                }

                //request temporary folder from file system
                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + PARAMETERS.TEMP_DIR, _gotFS, _onError);
            }

            //imp: ios needs the file:// protocol
            const protocol = (rootStore.device.platform === PARAMETERS.IOS) ? utilsService.getProtocol(sourcePathURL) : '';
            window.resolveLocalFileSystemURL(protocol + sourcePathURL, _onSuccess, _onError);
        });
    },

    //move media files
    moveToAppProjectDir(file_URI, filename, media_type, project_ref) {
        const rootStore = useRootStore();
        return new Promise((resolve, reject) => {
            const media_dir = utilsService.getFilePath(media_type);

            function _onError(error) {
                console.log(error);
                reject(error);
            }

            function _onSuccess(file_entry) {
                function _gotFS(filesystem) {
                    //create project folder if not exists
                    //create new project directory (if not exits)
                    filesystem.getDirectory(project_ref, {
                        create: true,
                        exclusive: false
                    }, _onCreateProjectDirectorySuccess, _onError);

                    function _onCreateProjectDirectorySuccess() {
                        //move video file from cache directory to video private directory with new name
                        file_entry.moveTo(filesystem, '/' + project_ref + '/' + filename, function (success) {
                            console.log(success);
                            resolve();
                        }, _onError);
                    }
                }

                window.resolveLocalFileSystemURL(cordova.file.dataDirectory + media_dir, _gotFS, _onError);
            }

            //ios needs the protocol to resolve a local file
            const protocol = (rootStore.device.platform === PARAMETERS.IOS) ? utilsService.getProtocol(file_URI) : '';
            //get file entry resolving file full path (wherever it was saved)
            window.resolveLocalFileSystemURL(protocol + file_URI, _onSuccess, _onError);
        });
    },

    //copy logo img for demo project from assets/www - > READ ONLY, so we cannot move but just copy https://goo.gl/e7D3MU
    copyDemoProjectLogoToPrivateDir() {

        const rootStore = useRootStore();
        const project_ref = DEMO_PROJECT.PROJECT_REF;
        const media_dir = PARAMETERS.LOGOS_DIR;
        const stored_filename = DEMO_PROJECT.PROJECT_LOGO_STORED_FILENAME;
        const filename = DEMO_PROJECT.PROJECT_LOGO_IMG_FILENAME;

        return new Promise((resolve, reject) => {
            function _onError(error) {
                console.log(error);
                reject(error);
            }

            function _onSuccess(file_entry) {
                function _gotFS(filesystem) {
                    //create project folder if not exists
                    filesystem.getDirectory(project_ref, {
                        create: true,
                        exclusive: false
                    }, _onCreateProjectDirectorySuccess, _onError);

                    function _onCreateProjectDirectorySuccess() {
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
                //get file entry resolving file full path (wherever is was saved)
                if (rootStore.device.platform === PARAMETERS.IOS) {
                    //Capacitor.convertFileSrc

                    console.log('capacitor -> ' + Capacitor.convertFileSrc(protocol + logo_img_URI + filename));
                    // logo_img_URI = logo_img_URI.replace('file://', 'cdvfile://');
                    logo_img_URI = Capacitor.convertFileSrc(logo_img_URI);
                    window.resolveLocalFileSystemURL((logo_img_URI + filename), _onSuccess, _onError);
                } else {
                    window.resolveLocalFileSystemURL(protocol + logo_img_URI + filename, _onSuccess, _onError);
                }
            } else {
                // If web, resolve
                resolve();
            }
        });
    }
};
