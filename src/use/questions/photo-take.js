import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings.js';
import {Camera, CameraResultType, CameraSource} from '@capacitor/camera';
import {CameraPreview} from '@capgo/camera-preview';
import {Capacitor} from '@capacitor/core';
import {modalController} from '@ionic/vue';
import {notificationService} from '@/services/notification-service';
import ModalCameraPreview from '@/components/modals/ModalCameraPreview.vue';
import {utilsService} from '@/services/utilities/utils-service';
import {moveFileService} from '@/services/filesystem/move-file-service';
import {resizePhotoService} from '@/services/filesystem/resize-photo-service';
import {rollbarService} from '@/services/utilities/rollbar-service';

export async function photoTake({media, entryUuid, state, filename, action}) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const tempDir = rootStore.tempDir;
    let cameraOptions = {};
    let sourceType = '';

    //a second tap while a capture is already in flight must be ignored:
    //two concurrent Camera.getPhoto() calls compete (second fails or both
    //open) and two ModalCameraPreview presents collide (second present
    //rejects, leaving an error alert plus a stuck modal)
    if (rootStore.isPhotoCaptureActive) {
        return;
    }
    rootStore.isPhotoCaptureActive = true;
    try {
    function _loadImageOnView(source) {
        const timestamp = utilsService.generateTimestamp();
        state.fileSource = source;
        //fix for WKWebView and Android 11+ as well
        source = Capacitor.convertFileSrc(source);
        //use a timestamp to refresh image
        state.imageSource = source + '?t=' + timestamp;
    }

    await notificationService.showProgressDialog(labels.wait);

    async function openCamera() {

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

        //bridge the native camera launch gap: intentionally fire-and-forget
        //(never awaited, so the camera intent fires immediately) dismisses
        //the spinner ~2s later underneath the camera activity. Awaiting here
        //would stall the launch itself by the delay
        notificationService.hideProgressDialog(2000);

        //snapshot the previous references: a failed replacement must restore
        //them instead of dropping the existing photo from the entry
        const previousCached = media[entryUuid][state.inputDetails.ref].cached;
        const previousAnswer = state.answer.answer;

        try {
            const imageURI = await Camera.getPhoto(cameraOptions);

            await notificationService.stopForegroundService();

            //cover the file move below: the system camera is gone and the
            //move + thumbnail decode takes a moment with no other feedback
            //(same saving dialog as the in-app branch). Single owner: shown
            //here, hidden after the thumbnail lands or before the failure
            //alert, so it can never strand
            await notificationService.showProgressDialog(labels.saving, labels.wait);

            //resolve the target filename without touching the references yet
            //(shared pick-rules: reuse cached on retake, stored on edit,
            //generate only for a brand-new file)
            filename = utilsService.resolvePhotoFilename(
                media[entryUuid][state.inputDetails.ref],
                entryUuid
            );

            console.log('Photo URI (original filename): ' + imageURI.path);
            console.log('Filename to be copied to: ' + filename);

            //move first, then persist the references: a rejected move must never leave the
            //answer/cached filename pointing at a file that does not exist (same ordering
            //guarantee as video-shoot; prevents FileError 1 on save). Awaiting also routes
            //a move failure into the rollback below
            await moveFileService.moveToAppTemporaryDir(imageURI.path, filename);

            media[entryUuid][state.inputDetails.ref].cached = filename;
            state.answer.answer = filename;
            _loadImageOnView(tempDir + filename);
            //thumbnail state is set synchronously above: dismiss the dialog
            await notificationService.hideProgressDialog(0);
        } catch (error) {
            console.log(error);
            await notificationService.stopForegroundService();
            await notificationService.hideProgressDialog();
            if (!(typeof error.message === 'string' && error.message.toLowerCase().includes('user cancelled photos app'))) {
                rollbarService.criticalWithContext('photoTake capture failed', error);
                //restore the previous references so a failed retake does not drop
                //the existing photo (fresh captures restore '' as before, so the
                //entry save never points at a missing file)
                media[entryUuid][state.inputDetails.ref].cached = previousCached;
                // Reset answer
                state.answer.answer = previousAnswer;
                await notificationService.showAlert(error.message || labels.unknown_error);
            }
        }
    }

    if (rootStore.device.platform !== PARAMETERS.WEB) {

        const useInAppCamera = rootStore.inAppCamera
            && rootStore.device.platform === PARAMETERS.ANDROID
            && action === 'camera';

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
                backdropDismiss: true
            });
            //guard the EntriesAdd back handler while the camera is open (same pattern
            //as isAudioModalActive/isLocationModalActive), so back never navigates the
            //question page while the camera modal is presented
            rootStore.isCameraPreviewModalActive = true;
            try {
                await modal.present();
                const { data } = await modal.onDidDismiss();

                if (data && data.startError) {
                    //the embedded camera could not start (permission denied,
                    //camera unavailable): tell the user instead of closing as
                    //if they cancelled. A back-button cancel dismisses without
                    //data and stays silent
                    await notificationService.showAlert(data.startError, labels.error);
                } else if (data && data.sourcePath) {
                //reuse the existing filename when replacing/retaking (same shared
                //pick-rules as the native branch above): on edit the retake keeps the
                //stored name so the answer, the media row and the file on disk stay
                //in agreement (save maps cached->stored, insertMedia keys on the
                //stored name). Repeated captures therefore do not orphan a temp
                //file per attempt
                filename = utilsService.resolvePhotoFilename(
                    media[entryUuid][state.inputDetails.ref],
                    entryUuid
                );
                //snapshot the previous references: a failed replacement must restore
                //them instead of dropping the existing photo from the entry
                const previousCached = media[entryUuid][state.inputDetails.ref].cached;
                const previousAnswer = state.answer.answer;
                //Filesystem.writeFile truncates the target in place, so a retake
                //writes onto the very file the rollback restores: back up the
                //previous bytes first (a resized temp photo, ~100-300KB) so a
                //mid-write failure can be undone below. Fresh captures have no
                //previous file and skip the backup
                const isRetake = previousCached === filename && previousCached !== '';
                let previousData = null;
                if (isRetake) {
                    try {
                        const { Filesystem } = await import('@capacitor/filesystem');
                        const read = await Filesystem.readFile({ path: tempDir + filename });
                        previousData = read && read.data ? read.data : null;
                    } catch (backupError) {
                        console.log('Failed to back up previous temp photo: ' + backupError);
                    }
                }
                //cover the resize below: with large captures the decode/downscale
                //takes a moment, and the modal (with its own feedback) is already
                //gone. Single owner: shown here, hidden after the thumbnail lands
                //or before the failure alert, so it can never strand
                await notificationService.showProgressDialog(labels.saving, labels.wait);
                try {
                    //location denied at capture: strip any GPS tags from the output
                    //while keeping every other tag (granted captures keep lat/long)
                    await resizePhotoService.resizeToTempDir(data.sourcePath, filename, { stripGps: data.gpsFallback === true });
                    media[entryUuid][state.inputDetails.ref].cached = filename;
                    state.answer.answer = filename;
                    //show the captured photo on the question view
                    _loadImageOnView(tempDir + filename);
                    //thumbnail state is set synchronously above: dismiss the dialog
                    await notificationService.hideProgressDialog(0);
                } catch (error) {
                    console.log(error);
                    //the replacement photo could not be processed: track it, the
                    //capture is lost even though the previous references survive.
                    //a failed write may have truncated the retake target in place:
                    //restore the backed-up bytes so the previous photo is intact,
                    //not just referenced (best-effort; a double fault leaves a
                    //partial file that self-heals via clearTemporaryDir())
                    if (previousData !== null) {
                        try {
                            const { Filesystem } = await import('@capacitor/filesystem');
                            await Filesystem.writeFile({
                                path: tempDir + filename,
                                data: previousData,
                                recursive: true
                            });
                        } catch (restoreError) {
                            console.log('Failed to restore previous temp photo: ' + restoreError);
                        }
                    }
                    rollbarService.criticalWithContext('photoTake resize failed', error);
                    //restore the previous references so a failed retake does not drop
                    //the existing photo (fresh captures restore '' as before, so the
                    //entry save never points at a missing file)
                    media[entryUuid][state.inputDetails.ref].cached = previousCached;
                    state.answer.answer = previousAnswer;
                    //dismiss the resize dialog before alerting (same hide-then-alert
                    //ordering as the native branch)
                    await notificationService.hideProgressDialog(0);
                    await notificationService.showAlert(error.message || labels.unknown_error);
                } finally {
                    //the modal hands the capture over without deleting it (the resize read
                    //above races an unmount-time deletion), so delete the temp capture now
                    //that it has been consumed (or failed), keeping the app cache clean
                    try {
                        await CameraPreview.deleteFile({path: data.sourcePath});
                    } catch (deleteError) {
                        console.log('Failed to delete captured photo: ' + deleteError);
                    }
                }
            } else {
                //dismissed without capturing (back button): preserve any existing
                //photo, so saving the entry does not drop the original attachment
            }
            } finally {
                //modal is gone (dismissed by ✕ or back button), or presentation
                //failed: always unguard the EntriesAdd back handler
                rootStore.isCameraPreviewModalActive = false;
            }
        } else {
            sourceType = action === 'gallery' ? CameraSource.Photos : CameraSource.Camera;

            //wontfix: the system path keeps the source aspect via the plugin's 1024
            //fit-box (e.g. 2448x1167 -> ~1024x488); the server does the final
            //crop/stretch. Client-side cover-crop would silently discard panorama
            //edges — see docs/ARCHITECTURE.md "Server photo size constraint".
            cameraOptions = {
                quality: 50,
                source: sourceType,
                resultType: CameraResultType.Uri,
                width: 1024,
                height: 1024,
                format: 'jpeg',
                correctOrientation: true
            };

            await openCamera();
        }
    } else {
        await notificationService.hideProgressDialog();
    }
    } finally {
        rootStore.isPhotoCaptureActive = false;
    }
}
