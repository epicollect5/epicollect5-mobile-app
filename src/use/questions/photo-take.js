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

export async function photoTake({media, entryUuid, state, filename, action}) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const tempDir = rootStore.tempDir;
    let cameraOptions = {};
    let sourceType = '';

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

        //dismiss the waiting spinner before opening the native camera
        await notificationService.hideProgressDialog(0);

        try {
            const imageURI = await Camera.getPhoto(cameraOptions);

            await notificationService.stopForegroundService();

            //if we do not have taken any photo yet, generate a new file name
            if (media[entryUuid][state.inputDetails.ref].cached === '') {
                //check if we have a stored filename, i.e. user is replacing the photo for the entry
                if (media[entryUuid][state.inputDetails.ref].stored === '') {
                    //generate new file name, this is a brand-new file
                    filename = utilsService.generateMediaFilename(
                        entryUuid,
                        PARAMETERS.QUESTION_TYPES.PHOTO
                    );
                } else {
                    //use stored filename
                    filename = media[entryUuid][state.inputDetails.ref].stored;
                }

                media[entryUuid][state.inputDetails.ref].cached = filename;
            } else {
                //use the cached path not to fill the cache with a new file all the time
                filename = media[entryUuid][state.inputDetails.ref].cached;
            }

            state.answer.answer = filename;
            console.log('Photo URI (original filename): ' + imageURI.path);
            console.log('Filename to be copied to: ' + filename);

            //Rename photo file by moving it
            moveFileService
                .moveToAppTemporaryDir(imageURI.path, filename)
                .then(function () {
                    _loadImageOnView(tempDir + filename);
                });
        } catch (error) {
            console.log(error);
            await notificationService.stopForegroundService();
            notificationService.hideProgressDialog();
            if (!(typeof error.message === 'string' && error.message.toLowerCase().includes('user cancelled photos app'))) {
                //reset media object to avoid trying to save a file that does not exist...
                //imp: if we do not do this and no file exists, error 1 is thrown when saving entry at the end
                media[entryUuid][state.inputDetails.ref].cached = '';
                // Reset answer
                state.answer.answer = '';
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
            await modal.present();
            const { data } = await modal.onDidDismiss().finally(() => {
                //modal is gone (dismissed by ✕ or back button): unguard the EntriesAdd back handler
                rootStore.isCameraPreviewModalActive = false;
            });

            if (data && data.sourcePath) {
                filename = utilsService.generateMediaFilename(
                    entryUuid,
                    PARAMETERS.QUESTION_TYPES.PHOTO				);
                try {
                    await resizePhotoService.resizeToTempDir(data.sourcePath, filename);
                    media[entryUuid][state.inputDetails.ref].cached = filename;
                    state.answer.answer = filename;
                    //show the captured photo on the question view
                    _loadImageOnView(tempDir + filename);
                } catch (error) {
                    console.log(error);
                    //reset the media object so the entry save does not try to save a missing file
                    media[entryUuid][state.inputDetails.ref].cached = '';
                    state.answer.answer = '';
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
                media[entryUuid][state.inputDetails.ref].cached = '';
                state.answer.answer = '';
            }
        } else {
            sourceType = action === 'gallery' ? CameraSource.Photos : CameraSource.Camera;

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
        notificationService.hideProgressDialog();
    }
}
