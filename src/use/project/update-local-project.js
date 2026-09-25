import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { versioningService } from '@/services/utilities/versioning-service';
import { notificationService } from '@/services/notification-service';
import { STRINGS } from '@/config/strings';
import { errorsService } from '@/services/errors-service';
import { alertController } from '@ionic/vue';
import { utilsService } from '@/services/utilities/utils-service';
import { showUpdaterModal } from '@/components/modals/ModalProjectUpdater.vue';

async function cleanupUpdateModal(handle) {
    const rootStore = useRootStore();
    if (handle) {
        await handle.modal.dismiss();
    }
    rootStore.isProjectUpdating = false;
    rootStore.isProjectUpdateModalActive = false;
    rootStore.progressUpdate = { total: 0, done: 0 };
    rootStore.updateDone = false;
}

async function confirmProjectUpdate() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    return new Promise((resolve) => {
        (async () => {
            const buttons = [];
            buttons.push({
                text: STRINGS[language].labels.learn_more,
                handler: () => {
                    window.open(PARAMETERS.UPDATE_PROJECT_DOCS_URL, '_system', 'location=yes');
                    return false;
                }
            });
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
            try {
                const createdAlert = await alertController.create({
                    header: STRINGS[language].labels.project_outdated,
                    message: STRINGS[language].labels.update_project,
                    buttons,
                    cssClass: 'alert-confirm-single-vertical-' + rootStore.device.platform.toLowerCase()
                });
                await createdAlert.present();
            } catch (presentError) {
                console.log('update confirm failed: ' + presentError);
                resolve(false);
            }
        })();
    });
}

export async function updateLocalProject() {
    const rootStore = useRootStore();
    const language = rootStore.language;

    let upToDate = true;
    try {
        upToDate = await versioningService.checkProjectVersion();
    } catch (error) {
        console.error('Error checking project version:', error);
        return false;
    }
    if (upToDate) {
        return false;
    }

    if (rootStore.continueProjectVersionBackgroundCheck !== true) {
        return false;
    }

    // Lock hardware back for the whole decision + update: the confirm alert
    // blocks taps but not the back button, and there is no way to cancel it.
    rootStore.isProjectUpdating = true;
    const confirmed = await confirmProjectUpdate();
    if (!confirmed) {
        rootStore.isProjectUpdating = false;
        return false;
    }

    let handle = null;
    const updaterTitle = STRINGS[language].labels.updating_project_title;
    try {
        handle = await showUpdaterModal(updaterTitle);
    } catch (presentError) {
        console.log('updater presentation failed: ' + presentError);
        await cleanupUpdateModal(null);
        return false;
    }

    let capturedError = null;
    try {
        await versioningService.updateProject({
            onProgress: (progress) => {
                rootStore.progressUpdate = { total: progress.formsTotal, done: progress.formIndex };
            }
        });
    } catch (error) {
        capturedError = error;
    }
    if (capturedError) {
        await cleanupUpdateModal(handle);
    } else {
        // Hold the "updating" phase briefly so the modal never flashes,
        // then flip to the done phase and wait for the user to dismiss
        // with OK (like the previous success alert).
        await utilsService.delay(3 * PARAMETERS.DELAY_LONG);
        rootStore.updateDone = true;
        await handle.modal.onDidDismiss();
        handle = null;
        await cleanupUpdateModal(handle);
    }

    if (capturedError) {
        const authErrors = PARAMETERS.AUTH_ERROR_CODES;
        const code = capturedError?.data?.errors?.[0]?.code;
        if (capturedError?.isStaleCleanupError) {
            await notificationService.showAlert(
                STRINGS[language].labels.stale_cleanup_failed,
                STRINGS[language].labels.error
            );
        } else if (authErrors.indexOf(code) >= 0) {
            await notificationService.showAlert(STRINGS[language].status_codes[code]);
        } else {
            await errorsService.handleWebError(capturedError);
        }
        return false;
    }
    return true;
}
