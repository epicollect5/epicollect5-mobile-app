import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {Capacitor} from '@capacitor/core';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {moveFileService} from '@/services/filesystem/move-file-service';
import { VideoEditor } from '@whiteguru/capacitor-plugin-video-editor';
import { CameraPreview } from '@capgo/camera-preview';
import ModalProgressEncoding from '@/components/modals/ModalProgressEncoding';
import ModalCameraPreview from '@/components/modals/ModalCameraPreview.vue';
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

    //Transcode the captured video, move it to the app temp dir and persist the
    //filename. Shared by the native system camera and the in-app camera flows.
    //stopService releases the foreground service when the native flow started it
    //(the in-app flow never starts one: the app stays in the foreground the whole
    //time, which is the point of the embedded camera).
    //deleteCapture removes the raw capture file after transcoding: only the in-app
    //flow sets it, because only the embedded camera records into the plugin's own
    //cache (Movies/CameraPreview), which must not accumulate after each recording.
    async function _processCapturedVideo(videoPath, stopService, deleteCapture) {
        console.log('SOURCE VIDEO INFO:', videoPath);
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
                path: videoPath,
                transcode: {
                    width: 1280,
                    height: 720,
                    fps: 30,
                    keepAspectRatio: true
                }
            });

            // 4. Move Encoded file (Using await instead of .then for clarity)
            await moveFileService.moveToAppTemporaryDir(result.file.path, filename);

            //persist the captured filename only after the file has actually been moved,
            //so a cancelled or aborted capture never leaves a phantom filename that
            //fails to move on save (FileError 1)
            media[entryUuid][state.inputDetails.ref].cached = filename;
            state.answer.answer = filename;

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
            if (stopService) {
                await notificationService.stopForegroundService();
            }
            if (deleteCapture) {
                //discard the raw plugin recording (transcoded copy is already in temp);
                //best-effort: the file may be outside the sandbox on other flows
                try {
                    await CameraPreview.deleteFile({path: videoPath});
                } catch (error) {
                    console.log('Failed to delete raw video capture: ' + error);
                }
            }
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
        } else {
        //use the cached path not to fill the cache with a new file all the time
        filename = media[entryUuid][state.inputDetails.ref].cached;
    }

    //use the embedded camera preview for video recording (Android only, opt-in):
    //no foreground service is needed because the app never leaves the foreground
    //(unlike the system camera app), and the captured file goes through the same
    //transcode + move pipeline as the native flow
    const useInAppCamera = rootStore.inAppCameraVideo
        && rootStore.device.platform === PARAMETERS.ANDROID;

    if (useInAppCamera) {
        await notificationService.hideProgressDialog(0);
        const modal = await modalController.create({
            component: ModalCameraPreview,
            cssClass: 'modal-camera-preview',
            //no backdrop is shown (showBackdrop: false), but backdropDismiss must be
            //true for Ionic to register the overlay on the Android back button
            //handler, otherwise back does not close the camera
            showBackdrop: false,
            canDismiss: true,
            backdropDismiss: true,
            componentProps: {
                mode: 'video'
            }
        });
        //guard the EntriesAdd back handler while the camera is open (same pattern
        //as photo-take), so back never navigates the question page while recording
        rootStore.isCameraPreviewModalActive = true;
        await modal.present();
        const { data } = await modal.onDidDismiss().finally(() => {
            //modal is gone (dismissed by ✕ or back button): unguard the EntriesAdd back handler
            rootStore.isCameraPreviewModalActive = false;
        });

        if (data && data.videoFilePath) {
            await _processCapturedVideo(data.videoFilePath, false, true);
        } else {
            //cancelled: reset the media object so the entry save does not reference a missing file
            media[entryUuid][state.inputDetails.ref].cached = '';
            state.answer.answer = '';
        }
        return;
    }

    //=== native system camera flow ===

    await notificationService.showProgressDialog(labels.wait);

    const options = {
        limit: 1 //record 1 video at a time
    };

    // start video capture
    //request camera permission (Android)
    if (rootStore.device.platform === PARAMETERS.ANDROID) {

        let fsChoice = 'dismiss';
        try {
            fsChoice = await notificationService.startForegroundService();
        } catch (error) {
            console.log('Failed to start foreground service: ' + error);
        }

        //if the user left to system settings or docs, do not launch the camera
        if (fsChoice === 'open_settings' || fsChoice === 'learn_more') {
            await notificationService.hideProgressDialog(0);
            return;
        }

        cordova.plugins.diagnostic.requestRuntimePermission(
            function (status) {
                if (status === cordova.plugins.diagnostic.permissionStatus.GRANTED) {
                    window.navigator.device.capture.captureVideo(
                        (media_object) => _processCapturedVideo(media_object[0].fullPath, true, false),
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
                        (media_object) => _processCapturedVideo(media_object[0].fullPath, true, false),
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