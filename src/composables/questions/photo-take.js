import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings.js';
import {Camera, CameraResultType, CameraSource} from '@capacitor/camera';
import {Capacitor} from '@capacitor/core';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {moveFileService} from '@/services/filesystem/move-file-service';

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

        await notificationService.startForegroundService();

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
    } else {
        notificationService.hideProgressDialog();
    }
}
