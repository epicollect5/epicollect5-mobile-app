import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {loadingController, alertController} from '@ionic/vue';
import {PushNotifications} from '@capacitor/push-notifications';
import {NativeSettings, AndroidSettings} from 'capacitor-native-settings';
import {databaseSelectService} from '@/services/database/database-select-service';
import {databaseInsertService} from '@/services/database/database-insert-service';
import {Toast} from '@capacitor/toast';
import {Capacitor} from '@capacitor/core';
import {useToast} from '@/use/toast';
import {modalController} from '@ionic/vue';
import {ForegroundService, Importance} from '@capawesome-team/capacitor-android-foreground-service';
import ModalProgressExport from '@/components/modals/ModalProgressExport.vue';

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

        // Convert message to string to avoid showing [object, object] for uncaught errors
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const headerStr = header || '';

        const alert = await alertController
            .create({
                header: headerStr,
                message: messageStr,
                buttons: [STRINGS[language].labels.ok]
            });
        await alert.present();
    },
    async confirmSingle(message, title, learnMoreUrl = null) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const platform = (rootStore.device.platform).toLowerCase();
        return new Promise((resolve) => {
            (async () => {
                const buttons = [];

                if (learnMoreUrl) {
                    buttons.push({
                        text: STRINGS[language].labels.learn_more,
                        handler: () => {
                            window.open(learnMoreUrl, '_system', 'location=yes');
                            return false;
                        }
                    });
                }

                buttons.push(
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
                );

                const alertOptions = {
                    header: title,
                    message,
                    buttons
                };

                if (learnMoreUrl) {
                    alertOptions.cssClass = 'alert-confirm-multiple-' + platform;
                }

                const alert = await alertController
                    .create(alertOptions);
                return alert.present();
            })();
        });
    },
    //Informational alert that can only be dismissed, with an optional learn more link
    async showDismissAlert(message, title, learnMoreUrl = null) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const buttons = [];

        if (learnMoreUrl) {
            buttons.push({
                text: STRINGS[language].labels.learn_more,
                handler: () => {
                    window.open(learnMoreUrl, '_system', 'location=yes');
                    return false;
                }
            });
        }

        buttons.push({
            text: STRINGS[language].labels.dismiss,
            role: 'cancel'
        });

        const alert = await alertController
            .create({
                header: title,
                message,
                buttons
            });
        return alert.present();
    },
    //multiple options modal
    async confirmMultiple(message, title, yesButton, noButton, yesAction, noAction) {

        const rootStore = useRootStore();
        const platform = (rootStore.device.platform).toLowerCase();
        const mode = platform === 'ios' ? 'ios' : 'md';
        const confirmYesAction = yesAction || PARAMETERS.ACTIONS.ENTRY_SAVE;
        const confirmNoAction = noAction || PARAMETERS.ACTIONS.ENTRY_QUIT;

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
                        resolve(confirmNoAction);
                    }
                },
                {
                    text: yesButton,
                    handler: () => {
                        resolve(confirmYesAction);
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
    //generic confirm alert with a dismiss button plus custom action buttons
    async confirmChoice(message, title, buttons = []) {
        const rootStore = useRootStore();
        const language = rootStore.language;

        return new Promise((resolve) => {
            (async () => {
                const confirmButtons = [
                    {
                        text: STRINGS[language].labels.dismiss,
                        role: 'cancel',
                        handler: () => {
                            resolve(false);
                        }
                    }
                ];

                buttons.forEach((button) => {
                    confirmButtons.push({
                        text: button.text,
                        handler: () => {
                            if (button.handler) {
                                button.handler();
                            }
                            resolve(true);
                        }
                    });
                });

                const alert = await alertController
                    .create({
                        header: title,
                        message,
                        buttons: confirmButtons
                    });
                await alert.present();
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
    /**
     * Hide the progress dialog (global object).
     * Optionally awaitable; fire-and-forget by design, await only when sequencing matters
     * (e.g. checkProjectVersion clears cache after dismiss).
     * @param {number} [delay] - ms before dismiss, defaults to PARAMETERS.DELAY_MEDIUM (500)
     * @returns {Promise<void>} resolves after dismiss (or immediately if no dialog)
     */
    hideProgressDialog(delay) {
        const rootStore = useRootStore();
        const set_delay = delay ?? PARAMETERS.DELAY_MEDIUM;

        return new Promise((resolve) => {
            setTimeout(async function () {
                try {
                    if (rootStore.ec5LoadingDialog !== null) {
                        console.log('dismiss dialog called');
                        await rootStore.ec5LoadingDialog.dismiss();
                    }
                } finally {
                    resolve();
                }
            }, set_delay);
        });
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

        return new Promise((resolve, reject) => {
            (async function () {
                //PushNotifications reflects the real OS POST_NOTIFICATIONS state:
                //'prompt' on a fresh API 33+ device (so we can request the native dialog),
                //'granted' once allowed, 'denied' if the user refused.
                let status = await PushNotifications.checkPermissions();
                //always attempt to request when not already granted: on a fresh API 33+
                //device this shows the native POST_NOTIFICATIONS prompt, and even when the
                //OS currently reports 'denied' it may still re-prompt (unless permanently denied)
                if (status.receive !== 'granted') {
                    await PushNotifications.requestPermissions();
                }

                //recheck after user interaction
                status = await PushNotifications.checkPermissions();

                if (status.receive === 'granted') {
                    await ForegroundService.createNotificationChannel({
                        id: 'ec5_notification',
                        name: PARAMETERS.APP_NAME,
                        description: labels.running,
                        importance: Importance.Low
                    });
                    await ForegroundService.startForegroundService({
                        id: 10,
                        title: PARAMETERS.APP_NAME,
                        body: labels.running,
                        smallIcon: 'ec5_notification',
                        notificationChannelId: 'ec5_notification'
                    });
                    resolve('granted');
                    return;
                }

                //permission denied: the foreground service cannot run, so the app is at
                //risk of being killed by Android while the camera/video/scanner is open.
                //Warn the user once (persisted in settings) and let them decide.
                //Dismiss the waiting spinner first so the user is never stuck behind it.
                await notificationService.hideProgressDialog(0);
                const res = await databaseSelectService.selectSetting(PARAMETERS.NOTIFICATIONS_PERMISSIONS_DENIED_WARNING_SHOWN);
                const alreadyShown = res.rows.length > 0 && res.rows.item(0).value === '1';
                if (!alreadyShown) {
                    const choice = await notificationService.showNotificationPermissionAlert(PARAMETERS.NOTIFICATIONS_PERMISSIONS_DOCS_URL);
                    await databaseInsertService.insertSetting(PARAMETERS.NOTIFICATIONS_PERMISSIONS_DENIED_WARNING_SHOWN, '1');
                    resolve(choice);
                    return;
                }
                //already warned before: proceed (warn but allow) without blocking
                resolve('dismiss');
            })().catch(reject);
        });
    },
    //Inform the user that, without the notification permission, the foreground
    //service cannot keep the app alive while the camera, video or barcode scanner is open.
    //Buttons (left to right): Dismiss | Learn More | Open Settings
    async showNotificationPermissionAlert(docsUrl) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;

        return new Promise((resolve) => {
            (async () => {
                const alert = await alertController.create({
                    header: labels.warning,
                    message: labels.notifications_permissions_denied_message,
                    buttons: [
                        {
                            text: labels.dismiss,
                            role: 'cancel',
                            handler: () => {
                                resolve('dismiss');
                            }
                        },
                        {
                            text: labels.learn_more,
                            handler: () => {
                                if (docsUrl) {
                                    window.open(docsUrl, '_system', 'location=yes');
                                }
                                resolve('learn_more');
                            }
                        },
                        {
                            text: labels.open_settings,
                            handler: () => {
                                NativeSettings.openAndroid({option: AndroidSettings.AppNotification});
                                resolve('open_settings');
                            }
                        }
                    ]
                });
                await alert.present();
            })();
        });
    },
    async stopForegroundService() {

        const rootStore = useRootStore();
        //skip for ios/web
        if (rootStore.device.platform !== PARAMETERS.ANDROID) {
            return;
        }
        await ForegroundService.stopForegroundService();
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
    }
};
