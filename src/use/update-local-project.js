
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { versioningService } from '@/services/utilities/versioning-service';
import { notificationService } from '@/services/notification-service';
import { STRINGS } from '@/config/strings';
import { errorsService } from '@/services/errors-service';
import { showModalLogin } from '@/use/show-modal-login';
import { logout } from '@/use/logout';


export function updateLocalProject () {
    const rootStore = useRootStore();
    const language = rootStore.language;

    return new Promise((resolve) => {
        async function updateProject () {
            /**
             * Common function used to start off the update process
             * Handles errors from updating the project, like setting a login callback
             */
            const authErrors = PARAMETERS.AUTH_ERROR_CODES;

            // Show loader
            await notificationService.showProgressDialog(
                STRINGS[language].labels.wait,
                STRINGS[language].labels.updating_project
            );

            versioningService.updateProject().then(
                async function (changeMade) {

                    // If new questions have been added, notify user
                    if (changeMade) {
                        await notificationService.showAlert(
                            STRINGS[language].status_codes.ec5_137
                        );
                    } else {
                        await notificationService.showAlert(
                            STRINGS[language].status_codes.ec5_136
                        );
                    }
                    // Hide existing loader
                    notificationService.hideProgressDialog();

                    // Show loader
                    await notificationService.showProgressDialog(
                        STRINGS[language].labels.wait,
                        STRINGS[language].labels.loading_entries
                    );

                    //project was updated
                    resolve(true);
                },
                async function (error) {
                    // Hide loader
                    notificationService.hideProgressDialog();

                    // Web error
                    console.log('fail');
                    // Check if we have an auth error
                    if (
                        authErrors.indexOf(error?.data?.errors[0]?.code) >= 0
                    ) {
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
                    } else {
                        // Other error
                        await errorsService.handleWebError(error);
                    }
                    //project was not updated
                    resolve(false);
                }
            );
        }

        versioningService.checkProjectVersion().then((upToDate) => {
            if (!upToDate) {
                // Project version out of date

                // If we are still on the entries (first form) page, as user if they want to update
                if (rootStore.continueProjectVersionUpdate === true) {
                    // Ask user if they want to upgrade the project
                    notificationService
                        .confirmSingle(
                            STRINGS[language].labels.update_project,
                            STRINGS[language].labels.project_outdated
                        )
                        .then((response) => {
                            // Update if user wants to
                            if (response) {
                                updateProject().then((updated) => {
                                    resolve(updated);
                                });
                            }
                        }, (error) => {
                            //do not update
                            resolve(false);
                            console.log('error', error);
                        });
                }
            }
            else {
                //project is up-to-date, do not update
                resolve(false);
            }
        });
    });
}
