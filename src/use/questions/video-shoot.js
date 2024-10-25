import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {Capacitor} from '@capacitor/core';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {moveFileService} from '@/services/filesystem/move-file-service';

export async function videoShoot({media, entryUuid, state, filename}) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const tempDir = rootStore.tempDir;

    function _onCaptureVideoSuccess(media_object) {
        const video_URI = media_object[0].fullPath;
        console.log(media_object[0]);
        console.log(video_URI);

        notificationService.stopForegroundService();

        //rename video file (by moving it)
        moveFileService.moveToAppTemporaryDir(video_URI, filename).then(
            function () {
                //set <video> source to video
                //Capacitor.convertFileSrc() -> fix for WKWebView
                //use timestamp to refresh UI
                const timestamp = utilsService.generateTimestamp();
                state.fileSource = Capacitor.convertFileSrc(tempDir + filename) + '?t=' + timestamp;
                notificationService.hideProgressDialog();
                notificationService.showToast(STRINGS[language].labels.video_saved);
            },
            function () {
                notificationService.hideProgressDialog();
                notificationService.showAlert(STRINGS[language].labels.cannot_save_file);
            }
        );
    }

    function _onCaptureVideoError(error) {
        console.log(error);
        notificationService.stopForegroundService();

        //reset media object to avoid saving a file that does not exist...
        //imp: if we do not do this and no file exists, error 1 is thrown when saving entry at the end
        media[entryUuid][state.inputDetails.ref].cached = '';
        // Reset answer
        state.answer.answer = '';

        //if not canceled by the user, show alert
        if (error.code !== 3) {
            notificationService.showAlert(error);
        } else {
            //otherwise just a toast
            notificationService.showToast(error.message);
        }
        notificationService.hideProgressDialog();
    }

    if (rootStore.device.platform !== PARAMETERS.WEB) {
        await notificationService.showProgressDialog(labels.wait);

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
                filename = utilsService.generateMediaFilename(
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

            await notificationService.startForegroundService();

            cordova.plugins.diagnostic.requestRuntimePermission(
                function (status) {
                    if (status === cordova.plugins.diagnostic.permissionStatus.GRANTED) {
                        window.navigator.device.capture.captureVideo(
                            _onCaptureVideoSuccess,
                            _onCaptureVideoError,
                            options
                        );
                    } else {
                        //warn user camera permission is compulsory
                        notificationService.showAlert(labels.missing_permission);
                        notificationService.stopForegroundService();
                        notificationService.hideProgressDialog();

                        //clear video references
                        state.answer.answer = '';
                        media[entryUuid][state.inputDetails.ref].cached = '';
                    }
                },
                function (error) {
                    state.answer.answer = '';
                    media[entryUuid][state.inputDetails.ref].cached = '';
                    console.error('The following error occurred: ' + error);
                    notificationService.showAlert(error);
                    notificationService.stopForegroundService();
                    notificationService.hideProgressDialog();
                },
                cordova.plugins.diagnostic.permission.CAMERA
            );
        } else {
            //ios permission
            window.cordova.plugins.diagnostic.isCameraAuthorized(
                function () {
                    window.navigator.device.capture.captureVideo(
                        _onCaptureVideoSuccess,
                        _onCaptureVideoError,
                        options
                    );
                },
                function (error) {
                    state.answer.answer = '';
                    media[entryUuid][state.inputDetails.ref].cached = '';
                    console.log(error);
                    console.error('The following error occurred: ' + error);
                    notificationService.showAlert(error.message);
                    notificationService.hideProgressDialog();
                }
            );
        }
    }
}