import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {Capacitor} from '@capacitor/core';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {moveFileService} from '@/services/filesystem/move-file-service';
import { VideoEditor } from '@whiteguru/capacitor-plugin-video-editor';
import ModalProgressEncoding from '@/components/modals/ModalProgressEncoding';
import { modalController } from '@ionic/vue';

export async function videoShoot({media, entryUuid, state, filename}) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const tempDir = rootStore.tempDir;
    rootStore.isVideoEncodingModalActive = false;

    if (rootStore.device.platform === PARAMETERS.WEB) {
        return;
    }

    async function _showModalProgressEncoding(header) {
        rootStore.isVideoEncodingModalActive =true;
        rootStore.progressEncoding = {done: 0};
        const modal = await modalController.create({
            cssClass: 'modal-progress-encoding',
            component: ModalProgressEncoding,
            showBackdrop: true,
            backdropDismiss: false,
            componentProps: {
                header
            }
        });
        return modal.present();
    }

    async function _onCaptureVideoSuccess(media_object) {
        const video_URI = media_object[0].fullPath;
        console.log('SOURCE VIDEO INFO:', media_object[0]);
        let progressListener = null;

        try {
            // 1. Initialize the listener immediately
            // noinspection JSDeprecatedSymbols,JSVoidFunctionReturnValueUsed,ES6RedundantAwait
            progressListener = await VideoEditor.addListener('transcodeProgress', (info) => {
                const progressValue = info.progress || 0;
                // Update Global Store and Notification Service
                rootStore.progressEncoding = {done: progressValue};
                notificationService.setProgressEncoding({done: progressValue});
            });

            // 2. Prepare UI
            notificationService.hideProgressDialog();
            await _showModalProgressEncoding(labels.encoding_video);

            // 3. Perform Transcoding
            const result = await VideoEditor.edit({
                path: video_URI,
                transcode: {
                    width: 1280,
                    height: 720,
                    keepAspectRatio: true
                }
            });

            // 4. Move Encoded file (Using await instead of .then for clarity)
            await moveFileService.moveToAppTemporaryDir(result.file.path, filename);

            // 5. Success UI Update
            const timestamp = utilsService.generateTimestamp();
            state.fileSource = Capacitor.convertFileSrc(tempDir + filename) + '?t=' + timestamp;
            notificationService.showToast(STRINGS[language].labels.video_saved);

        } catch (error) {
            console.error('Video processing failed:', error);
            await notificationService.showAlert(STRINGS[language].labels.cannot_save_file);
        } finally {
            // 6. Cleanup - This runs on both Success AND Error
            notificationService.hideProgressDialog();
            await notificationService.stopForegroundService();
            await modalController.dismiss();

            if (progressListener) {
                progressListener.remove();
            }

            // Reset progress with a slight delay so the user doesn't see the bar snap to 0
            window.setTimeout(() => {
                rootStore.progressEncoding = {done: 0};
                rootStore.isVideoEncodingModalActive =false;
            }, PARAMETERS.DELAY_LONG);
        }
    }


    function _onCaptureVideoError(error) {
        console.log(error);
        notificationService.stopForegroundService();
        //if not canceled by the user, show alert and reset media object
        if (error.code !== 3) {
            //reset media object to avoid saving a file that does not exist...
            //imp: if we do not do this and no file exists, error 1 is thrown when saving entry at the end
            media[entryUuid][state.inputDetails.ref].cached = '';
            // Reset answer
            state.answer.answer = '';
            notificationService.showAlert(error);
        }
        notificationService.hideProgressDialog();
    }

    await notificationService.showProgressDialog(labels.wait);

    const options = {
        limit: 1 //record 1 video at a time
    };

    //if we do not have done any recording yet, generate a new file name
    if (media[entryUuid][state.inputDetails.ref].cached === '') {
            //check if we have a stored filename, i.e. user is replacing the photo for the entry
            if (media[entryUuid][state.inputDetails.ref].stored === '') {
                //generate new file name, this is a brand-new file
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
