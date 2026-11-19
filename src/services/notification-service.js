import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {loadingController, alertController, toastController} from '@ionic/vue';
import {nextTick} from 'vue';
import {NativeLoader} from '@epicollect5/capacitor-native-loader';
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

//dismissal flag for the native loader: set by hideNativeLoader, checked by
//a native show that settles late (e.g. after the app was backgrounded and
//the bridge call stayed pending) so a stale ring cannot linger on an
//already-loaded question
let nativeLoaderDismissed = false;

//current sticky warning toast: shown by showWarningToast, dismissed by
//dismissWarningToast when the caller's operation is visually done
let warningToast = null;

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
    //Sticky top warning toast for long, UI-blocking operations (e.g. media
    //uploads in Dropzone): stays up until dismissWarningToast() is called,
    //the caller decides when the operation is visually done
    async showWarningToast(message) {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        const toast = await toastController.create({
            message: messageStr,
            position: 'top',
            color: 'warning',
            duration: 0,
            cssClass: 'upload-warning-toast'
        });
        warningToast = toast;
        await toast.present();
    },
    async dismissWarningToast() {
        if (warningToast) {
            await warningToast.dismiss();
            warningToast = null;
        }
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
                //Buttons are pushed in render order (left to right, top to bottom).
                //With the matching cssClass grid, Learn More spans the top row
                //and Cancel sits to the left of Ok on the bottom row.
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
                    buttons,
                    cssClass: 'alert-confirm-single-vertical-' + platform
                };

                const alert = await alertController
                    .create(alertOptions);
                return alert.present();
            })();
        });
    },
    //Informational alert that can only be dismissed, with an optional learn more link
    //dismissLabel defaults to "Dismiss": callers whose dismissal reads better as
    //"Ok" (e.g. error alerts) can override it
    async showDismissAlert(message, title, learnMoreUrl = null, dismissLabel = null) {
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
            text: dismissLabel || STRINGS[language].labels.dismiss,
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
        const mode = 'md';
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
        return new Promise((resolve, reject) => {
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
                //replace any existing instance without a visible gap: the new
                //spinner presents OVER the old one before the old is dismissed
                //(dismiss-then-create leaves the outgoing page bare while the
                //new overlay animates in, e.g. save spinner handing off to the
                //entries list loader mid-transition). The ref swaps only after
                //a successful present, so a failed create/present keeps the old
                //spinner up instead of losing it entirely
                const previousDialog = rootStore.ec5LoadingDialog;
                //create a global instance for the dialog
                const nextDialog = await loadingController
                    .create({
                        cssClass: 'ec5LoadingDialog',
                        message: ec5LoadingDialogMessage,
                        duration: parseInt(Number.POSITIVE_INFINITY)
                    });

                await nextDialog.present();
                rootStore.ec5LoadingDialog = nextDialog;
                if (previousDialog) {
                    try {
                        await previousDialog.dismiss();
                    } catch (error) {
                        console.log('previous dialog dismiss failed: ' + error);
                    }
                }
                resolve();
            }()).catch(reject);
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
                        try {
                            await rootStore.ec5LoadingDialog.dismiss();
                        } catch (error) {
                            //a stale dialog handle (e.g. replaced by the
                            //showProgressDialog overlap) dismisses as
                            //"overlay does not exist": already gone, ignore.
                            //Any other error is logged: this timer is
                            //fire-and-forget, rethrowing would only surface
                            //as an unhandled rejection
                            const gone = error === 'overlay does not exist'
                                || error?.message === 'overlay does not exist';
                            if (!gone) {
                                console.log('dialog dismiss failed: ' + error);
                            }
                        }
                    }
                } finally {
                    resolve();
                }
            }, set_delay);
        });
    },
    /**
     * Show the native fullscreen loader (native builds only).
     * Drawn outside the WebView: it keeps animating while the next
     * question render blocks the WebView thread, unlike the CSS spinner.
     * Await it before starting work that blocks the WebView. Never rejects
     * and never blocks past DELAY_LONG: a backgrounded app can leave the
     * native show pending indefinitely (the Android show latches the main
     * thread) and can reject on lifecycle errors — navigation must survive
     * both.
     */
    async showNativeLoader() {
        if (!Capacitor.isNativePlatform()) {
            return;
        }
        //match the CSS crescent spinner: a single-colour arc that contrasts
        //with the theme. Identical stops keep the native ring free of its
        //gradient. body.theme-dark is what themeService toggles, so it is the
        //authoritative mode signal. rgba() is the only colour format both
        //platforms parse the same way (Android reads 8-digit hex as
        //#AARRGGBB, iOS as #RRGGBBAA). reducedMotion must be 'ignore': with
        //the default 'system' a device with Reduce Motion enabled freezes
        //the ring (reads as a hang).
        const darkTheme = document.body.classList.contains('theme-dark');
        const colors = darkTheme ? ['#E6E6E6', '#E6E6E6'] : ['#333333', '#333333'];
        nativeLoaderDismissed = false;
        const showPromise = NativeLoader.show({
            style: 'ring',
            placement: 'fullscreen',
            size: 28,
            thickness: 2,
            colors,
            backgroundColor: 'rgba(0, 0, 0, 0)',
            interactionMode: 'block',
            reducedMotion: 'ignore'
        });
        //a show that settles after hideNativeLoader (a superseded navigation)
        //must hide itself instead of lingering over already-loaded content
        showPromise.then(() => {
            if (nativeLoaderDismissed) {
                NativeLoader.hideAll({animated: false});
            }
        }, (error) => {
            console.log('native loader show failed: ' + error);
        });
        //never block navigation on a bridge call that may stay pending
        await Promise.race([
            showPromise.catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, PARAMETERS.DELAY_LONG))
        ]);
    },
    /**
     * Hide the native fullscreen loader (native builds only).
     * Safe to call when no loader is showing.
     */
    async hideNativeLoader() {
        if (!Capacitor.isNativePlatform()) {
            return;
        }
        //mark dismissed before waiting: a native show that settles after
        //this point is a late arrival and must hide itself
        nativeLoaderDismissed = true;
        //hide the ring when the question content is on screen: a rAF callback
        //runs before its frame is painted, so one rAF still fires while the
        //new question is being laid out (a heavy group paints seconds after
        //its mount event) — the frame after it is the one to hide on
        await nextTick();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        try {
            await NativeLoader.hideAll({animated: false});
        } catch (error) {
            console.log('native loader hide failed: ' + error);
        }
    },
    /**
     * Dismiss the topmost modal, swallowing "overlay does not exist".
     * A modal dismissed twice (e.g. user-cancel racing the service
     * dismiss on entries-download) rejects with that string in Ionic:
     * the overlay is already gone, so there is nothing to do.
     * Any other dismiss error is rethrown.
     */
    async dismissModalSafe(...args) {
        try {
            await modalController.dismiss(...args);
        } catch (error) {
            const gone = error === 'overlay does not exist'
                || error?.message === 'overlay does not exist';
            if (!gone) {
                throw error;
            }
        }
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
                    try {
                        await databaseInsertService.insertSetting(PARAMETERS.NOTIFICATIONS_PERMISSIONS_DENIED_WARNING_SHOWN, '1');
                    } catch (error) {
                        console.log('Failed to persist notifications permissions warning: ' + error);
                    }
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

        return new Promise((resolve, reject) => {
            alertController.create({
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
            })
                .then((alert) => alert.present())
                .catch(reject);
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
        if (rootStore.isExportModalActive) {return;} // prevent multiple modals

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
        if (!rootStore.isExportModalActive) {return;}

        // 1. Dismiss the UI component
        await notificationService.dismissModalSafe();
        rootStore.isExportModalActive = false;

        // 2. Reset the progress state immediately so it's ready for next time
        notificationService.setProgressExport({total: 0, done: 0});
    }
};
