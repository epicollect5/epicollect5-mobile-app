import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { versioningService } from '@/services/utilities/versioning-service';
import { notificationService } from '@/services/notification-service';
import { STRINGS } from '@/config/strings';
import { errorsService } from '@/services/errors-service';
import { projectModel } from '@/models/project-model';
import { alertController } from '@ionic/vue';
import { utilsService } from '@/services/utilities/utils-service';
import { showUpdaterModal, dismissUpdaterModal } from '@/components/modals/ModalProjectUpdater.vue';

export const UPDATE_OUTCOMES = {
    UP_TO_DATE: 'UP_TO_DATE',
    DECLINED: 'DECLINED',
    UPDATED: 'UPDATED',
    UPDATE_FAILED: 'UPDATE_FAILED',
    CANCELLED: 'CANCELLED'
};

async function confirmProjectUpdate(signal) {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const platform = (rootStore.device.platform || '').toLowerCase();
    return new Promise((resolve) => {
        let settled = false;
        let alert = null;
        const done = (value) => {
            if (settled) {
                return;
            }
            settled = true;
            if (signal) {
                try {
                    signal.removeEventListener('abort', onAbort);
                } catch (listenerError) {
                    console.log('abort listener cleanup failed: ' + listenerError);
                }
            }
            resolve(value);
        };
        const onAbort = () => {
            if (alert) {
                try {
                    alert.dismiss();
                } catch (dismissError) {
                    console.log('abort dismiss failed: ' + dismissError);
                }
            }
            done({ outcome: UPDATE_OUTCOMES.CANCELLED });
        };
        if (signal) {
            if (signal.aborted) {
                done({ outcome: UPDATE_OUTCOMES.CANCELLED });
                return;
            }
            signal.addEventListener('abort', onAbort);
        }
        (async () => {
            const buttons = [];
            if (PARAMETERS.UPDATE_PROJECT_DOCS_URL) {
                buttons.push({
                    text: STRINGS[language].labels.learn_more,
                    handler: () => {
                        window.open(PARAMETERS.UPDATE_PROJECT_DOCS_URL, '_system', 'location=yes');
                        return false;
                    }
                });
            }
            buttons.push(
                {
                    text: STRINGS[language].labels.cancel,
                    role: 'cancel',
                    handler: () => {
                        done({ outcome: UPDATE_OUTCOMES.DECLINED, confirmed: false });
                    }
                },
                {
                    text: STRINGS[language].labels.ok,
                    handler: () => {
                        done({ outcome: 'CONFIRMED', confirmed: true });
                    }
                }
            );
            try {
                alert = await alertController.create({
                    header: STRINGS[language].labels.project_outdated,
                    message: STRINGS[language].labels.update_project,
                    buttons,
                    cssClass: 'alert-confirm-single-vertical-' + platform
                });
                if (signal && signal.aborted) {
                    try {
                        await alert.dismiss();
                    } catch (dismissError) {
                        console.log('abort dismiss failed: ' + dismissError);
                    }
                    done({ outcome: UPDATE_OUTCOMES.CANCELLED });
                    return;
                }
                await alert.present();
            } catch (presentError) {
                console.log('update confirm failed: ' + presentError);
                done({ outcome: UPDATE_OUTCOMES.CANCELLED });
            }
        })();
    });
}

export async function updateLocalProject(isCurrent, abortSignal) {
    const isCurrentCheck = typeof isCurrent === 'function' ? isCurrent : () => true;
    const rootStore = useRootStore();
    const language = rootStore.language;

    let upToDate = true;
    try {
        upToDate = await versioningService.checkProjectVersion();
    } catch (error) {
        console.error('Error checking project version:', error);
        return { outcome: UPDATE_OUTCOMES.UP_TO_DATE };
    }
    if (!isCurrentCheck()) {
        return { outcome: UPDATE_OUTCOMES.CANCELLED };
    }
    if (upToDate) {
        return { outcome: UPDATE_OUTCOMES.UP_TO_DATE };
    }

    if (rootStore.continueProjectVersionUpdate !== true) {
        if (!isCurrentCheck()) {
            return { outcome: UPDATE_OUTCOMES.CANCELLED };
        }
        return { outcome: UPDATE_OUTCOMES.DECLINED };
    }

    const confirmResult = await confirmProjectUpdate(abortSignal || null);
    if (confirmResult.outcome === UPDATE_OUTCOMES.CANCELLED) {
        return { outcome: UPDATE_OUTCOMES.CANCELLED };
    }
    if (!isCurrentCheck()) {
        return { outcome: UPDATE_OUTCOMES.CANCELLED };
    }
    if (!confirmResult.confirmed) {
        return { outcome: UPDATE_OUTCOMES.DECLINED };
    }

    rootStore.isProjectUpdating = true;
    rootStore.progressUpdate = { total: 0, done: 0 };
    rootStore.updateDone = false;
    const shownAt = Date.now();
    let handle = null;
    const updaterTitle = (STRINGS[language].labels.updating_project_title || STRINGS[language].labels.updating_project || '').replace(/\.\s*$/, '');
    try {
        handle = await showUpdaterModal(updaterTitle);
    } catch (presentError) {
        console.log('updater presentation failed: ' + presentError);
        rootStore.isProjectUpdating = false;
        rootStore.isProjectUpdateModalActive = false;
        return { outcome: UPDATE_OUTCOMES.UPDATE_FAILED, error: new Error('updater presentation failed') };
    }
    if (!isCurrentCheck()) {
        await dismissUpdaterModal(handle);
        rootStore.isProjectUpdating = false;
        return { outcome: UPDATE_OUTCOMES.CANCELLED };
    }

    const summary = {
        formsTotal: 0,
        formsDone: 0,
        changeMade: false,
        previousLastUpdated: null,
        lastUpdated: null
    };
    let capturedError = null;
    let updated = false;
    try {
        updated = await versioningService.updateProject({
            onProgress: (progress) => {
                rootStore.progressUpdate = { total: progress.formsTotal || 0, done: progress.formIndex || 0 };
            },
            summary
        });
    } catch (error) {
        capturedError = error;
    }
    if (capturedError) {
        await dismissUpdaterModal(handle);
        rootStore.isProjectUpdating = false;
        rootStore.progressUpdate = { total: 0, done: 0 };
        rootStore.updateDone = false;
    } else {
        // Keep the "updating" phase visible for a minimum time so the
        // modal never flashes, then flip to the done phase and wait for
        // the user to dismiss with OK (like the previous success alert).
        const minVisibleMs = 3 * PARAMETERS.DELAY_LONG;
        const remainingMs = minVisibleMs - (Date.now() - shownAt);
        if (remainingMs > 0) {
            await utilsService.delay(remainingMs);
        }
        if (!isCurrentCheck()) {
            await dismissUpdaterModal(handle);
            rootStore.isProjectUpdating = false;
            return { outcome: UPDATE_OUTCOMES.CANCELLED };
        }
        rootStore.updateDone = true;
        if (abortSignal) {
            if (abortSignal.aborted) {
                await dismissUpdaterModal(handle);
                rootStore.isProjectUpdating = false;
                rootStore.updateDone = false;
                return { outcome: UPDATE_OUTCOMES.CANCELLED };
            }
            const abortDismiss = () => {
                try {
                    if (handle && handle.modal && typeof handle.modal.dismiss === 'function') {
                        handle.modal.dismiss();
                    }
                } catch (abortError) {
                    console.log('abort updater dismiss failed: ' + abortError);
                }
            };
            abortSignal.addEventListener('abort', abortDismiss, { once: true });
            try {
                if (handle && handle.modal && typeof handle.modal.onDidDismiss === 'function') {
                    await handle.modal.onDidDismiss();
                }
            } finally {
                try {
                    abortSignal.removeEventListener('abort', abortDismiss);
                } catch (listenerError) {
                    console.log('abort listener cleanup failed: ' + listenerError);
                }
            }
        } else if (handle && handle.modal && typeof handle.modal.onDidDismiss === 'function') {
            await handle.modal.onDidDismiss();
        }
        await dismissUpdaterModal(handle);
        rootStore.isProjectUpdating = false;
        rootStore.progressUpdate = { total: 0, done: 0 };
        rootStore.updateDone = false;
    }

    if (!isCurrentCheck()) {
        return { outcome: UPDATE_OUTCOMES.CANCELLED };
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
        return { outcome: UPDATE_OUTCOMES.UPDATE_FAILED, error: capturedError };
    }
    if (!projectModel.hasInitialised()) {
        return { outcome: UPDATE_OUTCOMES.UPDATE_FAILED, error: new Error('project model lost after update') };
    }
    return { outcome: UPDATE_OUTCOMES.UPDATED, updated, diff: summary };
}
