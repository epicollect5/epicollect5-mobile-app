import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {loadingController, alertController} from '@ionic/vue';
import {PushNotifications} from '@capacitor/push-notifications';
import {Toast} from '@capacitor/toast';
import {Capacitor} from '@capacitor/core';
import {useToast} from '@/use/toast';
import {modalController} from '@ionic/vue';
import ModalProgressExport from '@/components/modals/ModalProgressExport.vue';
import {clipboardService} from '@/services/clipboard-service';

export const notificationService = {

    showToast(message, delay, position) {

        const setDelay = delay || 0;
        const setPosition = position || 'bottom';

        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

        setTimeout(async () => {

            //on native platforms use Capacitor Toast API
            if (Capacitor.isNativePlatform()) {

                await Toast.show({
                    text: messageStr,
                    duration: 'short',
                    position: setPosition
                });
            }
            //on the PWA use vanilla toast
            else {
                const toast = useToast();
                await toast.show({
                    message: messageStr,
                    position: setPosition
                });
            }
        }, setDelay);
    },
    async showAlert(message, header) {
        const rootStore = useRootStore();
        const language = rootStore.language;

        // Robustly convert various kinds of errors/values to a user-friendly string.
        // JSON.stringify on Error objects yields "{}", so prefer Error.message.
        const messageStr = (function (m) {
            if (m === undefined) return 'undefined';
            if (m === null) return 'null';
            if (typeof m === 'string') return m;
            if (m instanceof Error) {
                // Prefer the explicit message; include name if message missing
                return m.message || m.name || String(m);
            }
            // Some environments expose error-like objects with a message property
            if (typeof m === 'object' && 'message' in m && typeof m.message === 'string') {
                return m.message;
            }
            try {
                const str = JSON.stringify(m);
                if (str && str !== '{}') return str;
            } catch (e) {
                // fall through to other strategies
            }
            try {
                // If object has enumerable properties, list them
                if (typeof m === 'object') {
                    const entries = Object.entries(m);
                    if (entries.length > 0) {
                        return entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ');
                    }
                }
            } catch (e) {
                // ignore
            }
            return String(m);
        })(message);

        const headerStr = header || '';

        const alert = await alertController.create({
            header: headerStr,
            message: messageStr,
            buttons: [STRINGS[language].labels.ok]
        });
        await alert.present();
    },

    async confirmSingle(message, title) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        return new Promise((resolve) => {
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

                let ec5LoadingDialogMessage = '<strong class="ec5LoadingTitle">' + labels.wait + '</strong>';

                if (title) {
                    ec5LoadingDialogMessage = '<strong class="ec5LoadingTitle">' + title + '</strong><br/><br/><span class="ec5LoadingMessage">' + message + '</span>';
                } else {
                    if (message) {
                        ec5LoadingDialogMessage = '<strong class="ec5LoadingTitle">' + message + '</strong>';
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
    //set progress in global state for modalProgressTransfer
    setProgressTransfer(progress) {
        const rootStore = useRootStore();
        rootStore.progressTransfer = progress;
    },
    //set progress in global state for modalProgressEncoding
    setProgressEncoding(progress) {
        const rootStore = useRootStore();
        rootStore.progressEncoding = progress;
    },
    //set progress in global state for modalProgressExport
    setProgressExport(progress) {
        const rootStore = useRootStore();
        rootStore.progressExport = progress;
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
                } else {
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
    },

    /**
     * Show the progress export modal
     */
    async showProgressExportModal() {
        const rootStore = useRootStore();
        if (rootStore.isExportModalActive) return; // prevent multiple modals

        rootStore.isExportModalActive = true;
        const language = rootStore.language;
        const labels = STRINGS[language].labels;

        const modal = await modalController.create({
            cssClass: 'modal-progress-export',
            component: ModalProgressExport,
            showBackdrop: true,
            backdropDismiss: false,
            componentProps: {
                header: labels.exporting
            }
        });

        await modal.present();
    },

    /**
     * Hide the progress export modal and reset state
     */
    async hideProgressExportModal() {
        const rootStore = useRootStore();
        if (!rootStore.isExportModalActive) return;

        // 1. Dismiss the UI component
        await modalController.dismiss();
        rootStore.isExportModalActive = false;

        // 2. Reset the progress state immediately so it's ready for next time
        notificationService.setProgressExport({total: 0, done: 0});
    },

    /**
     * Shows a custom alert for validation errors with copy to clipboard option.
     */
    async showValidationErrorAlert(htmlMessage, plainText) {
        const rootStore = useRootStore();
        const language = rootStore.language;

        const alert = await alertController.create({
            header: 'Validation Error',
            message: htmlMessage,
            cssClass: 'validation-error-alert',
            buttons: [
                {
                    text: STRINGS[language].labels.copy || 'Copy',
                    handler: async () => {
                        const success = await clipboardService.copyText(plainText);
                        if (success) {
                            notificationService.showToast(STRINGS[language].labels.copied_to_clipboard);
                        } else {
                            notificationService.showToast(STRINGS[language].labels.unknown_error);
                        }
                        return false; // Prevent alert dismissal
                    }
                },
                {
                    text: STRINGS[language].labels.ok || 'OK',
                    role: 'cancel'
                }
            ]
        });
        await alert.present();
    }
};
