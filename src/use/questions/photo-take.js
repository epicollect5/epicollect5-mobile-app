import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings.js';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { moveFileService } from '@/services/filesystem/move-file-service';

export async function photoTake ({ media, entryUuid, state, filename, action }) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const tempDir = rootStore.tempDir;
    let cameraOptions = {};
    let sourceType = '';

    function _loadImageOnView (source) {
        const timestamp = utilsService.generateTimestamp();
        state.fileSource = source;
        //fix for WKWebView and Android 11+ as well
        source = Capacitor.convertFileSrc(source);
        //use a timestamp to refresh image
        state.imageSource = source + '?t=' + timestamp;
    }

    await notificationService.showProgressDialog(labels.wait);

    async function _openCamera () {

        await notificationService.startForegroundService();

        try {
            const imageURI = await Camera.getPhoto(cameraOptions);

            notificationService.stopForegroundService();

            //if we do not have taken any photo yet, generate a new file name
            if (media[entryUuid][state.inputDetails.ref].cached === '') {
                //check if we have a stored filename, i.e user is replacing the photo for the entry
                if (media[entryUuid][state.inputDetails.ref].stored === '') {
                    //generate new file name, this is a brand new file
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
            console.log('Photo URI: ' + imageURI.path);

            moveFileService
                .moveToAppTemporaryDir(imageURI.path, filename)
                .then(function () {
                    _loadImageOnView(tempDir + filename);
                });
            console.log(imageURI.path);
        } catch (error) {
            console.log(error);
            notificationService.stopForegroundService();
            notificationService.hideProgressDialog();
            notificationService.showToast(error);
        }
    }

    if (rootStore.device.platform !== PARAMETERS.WEB) {
        if (action === 'gallery') {
            sourceType = CameraSource.Photos;
        } else {
            sourceType = CameraSource.Camera;
        }

        cameraOptions = {
            quality: 50,
            source: sourceType,
            resultType: CameraResultType.Uri,
            width: 1024,
            height: 1024,
            format: 'jpeg',
            correctOrientation: true
        };

        //check permission IMPORTANT: we are using a fork of the cordova camera plugin due to an issue on MM
        // see https://goo.gl/WwNMSh
        window.cordova.plugins.diagnostic.isCameraAuthorized(
            function (response) {

                if (response) {
                    _openCamera();
                } else {
                    //request permission
                    cordova.plugins.diagnostic.requestCameraAuthorization(
                        function (permission) {

                            console.log(permission);

                            //check permission status android
                            if (rootStore.device.platform === PARAMETERS.ANDROID) {
                                if (
                                    permission === cordova.plugins.diagnostic.permissionStatus.GRANTED
                                ) {
                                    _openCamera();
                                }
                                else {
                                    //warn user camera permssion is compulsory
                                    notificationService.hideProgressDialog();
                                    notificationService.showAlert(labels.missing_permission);
                                }
                            } else {
                                //on iOS permission is true or false only
                                if (permission) {
                                    _openCamera();
                                }
                            }
                        },
                        function (error) {
                            notificationService.hideProgressDialog();
                            notificationService.showAlert(error);
                        }
                    );
                }
            },
            function (error) {
                notificationService.hideProgressDialog();
                notificationService.showAlert(error);
            }
        );
    } else {
        notificationService.hideProgressDialog();
    }
}