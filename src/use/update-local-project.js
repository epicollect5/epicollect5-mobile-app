import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {versioningService} from '@/services/utilities/versioning-service';
import {notificationService} from '@/services/notification-service';
import {STRINGS} from '@/config/strings';
import {errorsService} from '@/services/errors-service';
import {showModalLogin} from '@/use/show-modal-login';
import {logout} from '@/use/logout';

export async function updateLocalProject() {
    const rootStore = useRootStore();
    const language = rootStore.language;

    async function updateProject() {
        /**
         * Common function used to start off the update process
         * Handles errors from updating the project, like setting a login callback
         */
        const authErrors = PARAMETERS.AUTH_ERROR_CODES;

        await notificationService.showProgressDialog(
            STRINGS[language].labels.wait,
            STRINGS[language].labels.updating_project
        );

        try {
            const changeMade = await versioningService.updateProject();
            let message = STRINGS[language].status_codes.ec5_136;
            // If new questions have been added, notify user
            if (changeMade) {
                message = STRINGS[language].status_codes.ec5_137;
            }

            await notificationService.showAlert(message);
            // Hide existing loader
            notificationService.hideProgressDialog();
            // Show new loader
            await notificationService.showProgressDialog(
                STRINGS[language].labels.wait,
                STRINGS[language].labels.loading_entries
            );

            //project was updated
            return true;
        } catch (error) {
            // Hide loader
            notificationService.hideProgressDialog();
            // Web error
            if (authErrors.indexOf(error?.data?.errors?.[0]?.code) < 0) {
                // Other error
                await errorsService.handleWebError(error);
                return false;
            }

            // Handle Auth errors
            //imp: using a toast here because the alert modal would be
            //imp: hidden by the login modal.
            notificationService.showToast(
                STRINGS[language].status_codes[error.data.errors[0].code]
            );

            //the user is not logged in, so:
            //1 - set a callback to add the project after logging in
            rootStore.afterUserIsLoggedIn = {
                callback: updateProject,
                params: null
            };
            //2- Clear any token and ask user to login again
            await logout();
            showModalLogin();
            return false;
        }
    }

    const upToDate = await versioningService.checkProjectVersion();
    if (upToDate) {
        //project is up-to-date, do not update
        return false;
    }

    // Project version out of date
    // If we are still on the entries (first form) page, as user if they want to update
    if (rootStore.continueProjectVersionUpdate === true) {
        // Ask user if they want to upgrade the project
        const confirmed = await notificationService.confirmSingle(
            STRINGS[language].labels.update_project,
            STRINGS[language].labels.project_outdated
        );

        if (confirmed) {
            return await updateProject();
        } else {
            return false;
        }
    }
    else {
        return false;
    }
}
