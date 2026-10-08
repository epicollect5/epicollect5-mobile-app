import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { versioningService } from '@/services/utilities/versioning-service';
import { notificationService } from '@/services/notification-service';
import { STRINGS } from '@/config/strings';
import { errorsService } from '@/services/errors-service';
import { utilsService } from '@/services/utilities/utils-service';
import { confirmProjectUpdate } from '@/use/project/confirm-project-update.js';
import { showUpdaterModal, cleanupUpdateModal } from '@/use/project/show-updater-modal.js';

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
        // Fail-fast: each failure reports its own UI, no login retry and no
        // deferred callback. Staleness is enforced downstream by uploads,
        // downloads and the server.
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
