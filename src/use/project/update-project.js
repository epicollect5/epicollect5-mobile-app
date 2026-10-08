import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { showModalLogin } from '@/use/auth/show-modal-login';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { versioningService } from '@/services/utilities/versioning-service';
import { utilsService } from '@/services/utilities/utils-service';
import { logout } from '@/use/auth/logout';
import { projectModel } from '@/models/project-model';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';
import { confirmProjectUpdate } from '@/use/project/confirm-project-update.js';
import { showUpdaterModal, cleanupUpdateModal } from '@/use/project/show-updater-modal.js';

//Caller contract: true when the new project structure is in place. False
//covers a declined prompt, a failed update and a skip (no project); any error
//was already reported to the user by this flow.

export async function updateProject () {
    //no active project loaded: a deferred retry after login can fire on a page with no project,
    //so skip silently instead of crashing on an empty project model
    if (!projectModel.hasInitialised()) {
        console.warn('updateProject skipped: no active project');
        return false;
    }

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const authErrors = PARAMETERS.AUTH_ERROR_CODES;

    //lock navigation while the update is in flight: the loader overlay blocks taps,
    //but the hardware back button and the page controls still fire, and leaving
    //would destroy the model under the pending update continuation
    rootStore.isProjectUpdating = true;

    //same confirm as the Entries flow: Learn more / Cancel / OK, any other
    //dismissal route (e.g. Android back) settles as decline
    const confirmed = await confirmProjectUpdate();
    if (!confirmed) {
        //declining only dismisses the prompt: no update runs and nothing else is shown
        rootStore.isProjectUpdating = false;
        return false;
    }

    let handle = null;
    try {
        handle = await showUpdaterModal(labels.updating_project_title);
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
        // Stay on the requesting page: the update changes no routing, so the
        // upload/download flow that requested it continues where it was.
        // Hold the updating phase briefly so the modal never flashes, then flip
        // to the done phase and wait for the user to dismiss with OK.
        await utilsService.delay(3 * PARAMETERS.DELAY_LONG);
        rootStore.updateDone = true;
        await handle.modal.onDidDismiss();
        handle = null;
        await cleanupUpdateModal(handle);

        entriesDownloadProgressService.clearProject(projectModel.getProjectRef());
    }

    if (capturedError) {
        // Check if we have an auth error
        if (authErrors.indexOf(capturedError?.data?.errors?.[0]?.code) >= 0) {
            await notificationService.showAlert(
                STRINGS[language].status_codes[capturedError.data.errors[0].code]
            );
            //1 - set a callback to add the project after logging in
            rootStore.afterUserIsLoggedIn = {
                callback: updateProject,
                params: null
            };
            //2- Clear any token and ask user to login again
            await logout();
            showModalLogin();
        } else if (capturedError?.isStaleCleanupError) {
            // Failed to remove the entries of forms/branches removed from the project
            await notificationService.showAlert(
                labels.stale_cleanup_failed,
                labels.error
            );
        } else {
            // Other error
            await errorsService.handleWebError(capturedError);
        }
        return false;
    }
    return true;
}
