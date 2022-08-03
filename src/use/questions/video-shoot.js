
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import * as services from '@/services';
import { Capacitor } from '@capacitor/core';

export async function videoShoot ({ media, entryUuid, state, filename }) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const tempDir = rootStore.tempDir;

    function _onCaptureVideoSuccess (media_object) {
        const video_URI = media_object[0].fullPath;
        console.log(media_object[0]);
        console.log(video_URI);

        if (rootStore.device.platform === PARAMETERS.ANDROID) {
            //only for api >= 28 (Android 9)
            //app might crash on Android 8
            if (parseInt(rootStore.device.osVersion) >= 9) {
                cordova.plugins.foregroundService.stop();
            }
        }

        //rename video file (by moving it)
        services.moveFileService.moveToAppTemporaryDir(video_URI, filename).then(
            function () {
                //set <video> source to video
                //Capacitor.convertFileSrc() -> fix for WKWebView
                //use timestamp to refresh UI
                const timestamp = services.utilsService.generateTimestamp();
                state.fileSource = Capacitor.convertFileSrc(tempDir + filename) + '?t=' + timestamp;
                services.notificationService.hideProgressDialog();
                services.notificationService.showToast(STRINGS[language].labels.video_saved);
            },
            function () {
                services.notificationService.hideProgressDialog();
                services.notificationService.showAlert(STRINGS[language].labels.cannot_save_file);
            }
        );
    }

    function _onCaptureVideoError (error) {
        if (rootStore.device.platform === PARAMETERS.ANDROID) {
            //only for api >= 28 (Android 9)
            //app might crash on Android 8
            if (parseInt(rootStore.device.osVersion) >= 9) {
                cordova.plugins.foregroundService.stop();
            }
        }

        console.log(error);
        //reset media object to avoid saving a file that does not exist...
        media[entryUuid][state.inputDetails.ref].cached = '';
        // Reset answer
        state.answer.answer = '';
        services.notificationService.showToast(error.message);
        services.notificationService.hideProgressDialog();
    }


    if (rootStore.device.platform !== PARAMETERS.WEB) {
        await services.notificationService.showProgressDialog(labels.wait);

        //record 1 video at a time
        const options = {
            limit: 1
            //duration: 30//set duration to a maximum of 30 seconds
        };

        //if we do not have done any recording yet, generate a new file name
        if (media[entryUuid][state.inputDetails.ref].cached === '') {
            //check if we have a stored filename, i.e user is replacing the photo for the entry
            if (media[entryUuid][state.inputDetails.ref].stored === '') {
                //generate new file name, this is a brand new file
                filename = services.utilsService.generateMediaFilename(
                    entryUuid,
                    PARAMETERS.QUESTION_TYPES.VIDEO
                );
            } else {
                //use stored filename
                filename = media[entryUuid][state.inputDetails.ref].stored;
            }

            media[entryUuid][state.inputDetails.ref].cached = filename;
            state.answer.answer = filename;
        } else {
            //use the cached path not to fill the cache with a new file all the time
            filename = media[entryUuid][state.inputDetails.ref].cached;
        }

        // start video capture
        //request camera permission (Android)
        if (rootStore.device.platform === PARAMETERS.ANDROID) {
            cordova.plugins.diagnostic.requestRuntimePermission(
                function (status) {
                    if (status === cordova.plugins.diagnostic.runtimePermissionStatus.GRANTED) {
                        //request storage permission
                        cordova.plugins.diagnostic.requestRuntimePermission(
                            function (status) {
                                if (status === cordova.plugins.diagnostic.runtimePermissionStatus.GRANTED) {
                                    console.log('Permission granted');

                                    if (rootStore.device.platform === PARAMETERS.ANDROID) {
                                        //only for api >= 28 (Android 9)
                                        //app might crash on Android 8
                                        if (parseInt(rootStore.device.osVersion) >= 9) {
                                            cordova.plugins.foregroundService.start(
                                                PARAMETERS.APP_NAME,
                                                labels.working_in_background,
                                                'ic_launcher.png',
                                                1,
                                                10
                                            );
                                        }
                                    }

                                    window.navigator.device.capture.captureVideo(
                                        _onCaptureVideoSuccess,
                                        _onCaptureVideoError,
                                        options
                                    );
                                } else {
                                    services.notificationService.showAlert(
                                        STRINGS[language].labels.permission_denied
                                    );
                                    services.notificationService.hideProgressDialog();
                                }
                            },
                            function (error) {
                                console.error('The following error occurred: ' + error);
                                services.notificationService.hideProgressDialog();
                            },
                            cordova.plugins.diagnostic.runtimePermission.WRITE_EXTERNAL_STORAGE
                        );
                    } else {
                        services.notificationService.showAlert(
                            STRINGS[language].labels.permission_denied
                        );
                        services.notificationService.hideProgressDialog();
                    }
                },
                function (error) {
                    console.error('The following error occurred: ' + error);
                    services.notificationService.hideProgressDialog();
                },
                cordova.plugins.diagnostic.runtimePermission.CAMERA
            );
        } else {
            //ios permission
            window.cordova.plugins.diagnostic.isCameraAuthorized(
                function (authorised) {
                    window.navigator.device.capture.captureVideo(
                        _onCaptureVideoSuccess,
                        _onCaptureVideoError,
                        options
                    );
                },
                function (error) {
                    console.log(error);
                    console.error('The following error occurred: ' + error);
                    services.notificationService.showToast(error.message);
                    services.notificationService.hideProgressDialog();
                }
            );
        }
    }
}