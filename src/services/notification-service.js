import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { loadingController, toastController, alertController } from '@ionic/vue';
import { PushNotifications } from '@capacitor/push-notifications';
import { Toast } from '@capacitor/toast';


export const notificationService = {

    showToast(message, delay, position) {

        const setDelay = delay || 0;
        const setPosition = position || 'bottom';

        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

        setTimeout(async () => {
            await Toast.show({
                text: messageStr,
                duration: 'long',
                position: setPosition
            });
        }, setDelay);
    },
    showToastCenter(message, delay) {
        this.showToast(message, delay, 'center');
    },
    async showAlert(message, header) {
        const rootStore = useRootStore();
        const language = rootStore.language;

        // Convert message to string to avoid showing [object, object] for uncaught errors
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const headerStr = header || [STRINGS[language].labels.error];

        const alert = await alertController
            .create({
                header: headerStr,
                message: messageStr,
                buttons: [STRINGS[language].labels.ok]
            });
        await alert.present();
    },
    async confirmSingle(message, title) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        return new Promise((resolve, reject) => {
            (async () => {
                const alert = await alertController
                    .create({
                        header: title,
                        message,
                        buttons: [
                            {
                                text: STRINGS[language].labels.cancel,
                                role: 'cancel',
                                handler: () => {
                                    resolve(false);
                                }
                            },
                            {
                                text: STRINGS[language].labels.ok,
                                handler: () => {
                                    resolve(true);
                                }
                            }
                        ]
                    });
                return alert.present();
            })();
        });
    },
    //multiple options modal
    async confirmMultiple(message, title, yesButton, noButton) {

        const rootStore = useRootStore();
        const platform = (rootStore.device.platform).toLowerCase();
        const mode = platform === 'ios' ? 'ios' : 'md';

        return new Promise((resolve) => {

            const buttons = [
                {
                    text: STRINGS[rootStore.language].labels.dismiss,
                    role: 'cancel',
                    handler: () => {
                        resolve(false);
                    }
                },
                {
                    text: noButton,
                    handler: () => {
                        resolve(PARAMETERS.ACTIONS.ENTRY_QUIT);
                    }
                },
                {
                    text: yesButton,
                    handler: () => {
                        resolve(PARAMETERS.ACTIONS.ENTRY_SAVE);
                    }
                }
            ];

            //on the PWA, do not show save options when quitting
            if (rootStore.isPWA) {
                buttons.pop();
            }

            (async () => {
                const alert = await alertController
                    .create({
                        mode,
                        cssClass: 'alert-confirm-multiple-' + platform,
                        header: title,
                        message,
                        buttons
                    });
                return alert.present();
            })();
        });
    },
    //todo: test the web approach on slow devices
    async showProgressDialog(message, title) {
        return new Promise((resolve) => {
            (async function () {
                const rootStore = useRootStore();
                const language = rootStore.language;
                const labels = STRINGS[language].labels;

                let ec5LoadingDialogMessage = '';

                if (title) {
                    ec5LoadingDialogMessage = '<strong class="ec5LoadingTitle">' + title + '</strong><br/><br/>' + message;
                }
                else {
                    if (message) {
                        ec5LoadingDialogMessage = '<strong class="ec5LoadingTitle">' + message + '</strong>';
                    }
                    else {
                        ec5LoadingDialogMessage = '<strong class="ec5LoadingTitle">' + labels.wait + '</strong>';
                    }
                }
                //remove any existing instance
                if (rootStore.ec5LoadingDialog) {
                    rootStore.ec5LoadingDialog.dismiss();
                    rootStore.ec5LoadingDialog = null;
                }
                //create a global instance for the dialog
                rootStore.ec5LoadingDialog = await loadingController
                    .create({
                        cssClass: 'ec5LoadingDialog',
                        message: ec5LoadingDialogMessage,
                        duration: parseInt(Number.POSITIVE_INFINITY)
                    });

                await rootStore.ec5LoadingDialog.present();
                resolve();
            }());
        });
    },
    //set progress in global state for modalUpload
    setProgress(progress) {
        const rootStore = useRootStore();
        rootStore.progressTransfer = progress;
    },
    //Hide the progress dialog (global object)
    hideProgressDialog(delay) {
        const rootStore = useRootStore();
        const set_delay = delay || PARAMETERS.DELAY_MEDIUM;

        setTimeout(async function () {
            if (rootStore.ec5LoadingDialog !== null) {
                console.log('dismiss dialog called');
                await rootStore.ec5LoadingDialog.dismiss();
            }
        }, set_delay);
    },
    //start a foreground service (with notification)
    //to avoid Android killing the app
    async startForegroundService() {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;

        //skip for ios/web
        if (rootStore.device.platform !== PARAMETERS.ANDROID) {
            return;
        }

        return new Promise((resolve) => {
            (async function () {
                let status = await PushNotifications.checkPermissions();
                switch (status.receive) {
                    case 'granted':
                        //do nothing
                        break;
                    case 'prompt':
                        await PushNotifications.requestPermissions();
                        break;
                    case 'prompt-with-rationale':
                        await PushNotifications.requestPermissions();
                        break;
                    default:
                    //dp nothing
                }

                //recheck after user interaction
                status = await PushNotifications.checkPermissions();

                if (status.receive === 'granted') {
                    cordova.plugins.foregroundService.start(
                        PARAMETERS.APP_NAME,
                        labels.loading,
                        'ec5_notification',
                        1,
                        10
                    );
                    resolve();
                }
                else {
                    resolve();
                }
            })();
        });
    },
    async stopForegroundService() {

        const rootStore = useRootStore();
        //skip for ios/web
        if (rootStore.device.platform !== PARAMETERS.ANDROID) {
            return;
        }
        if (rootStore.device.platform === PARAMETERS.ANDROID) {
            //only for api >= 28 (Android 9)
            //app might crash on Android 8
            if (parseInt(rootStore.device.osVersion) >= 9) {
                cordova.plugins.foregroundService.stop();
            }
        }
    }
};