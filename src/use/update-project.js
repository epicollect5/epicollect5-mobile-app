import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { showModalLogin } from '@/use/show-modal-login';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { versioningService } from '@/services/utilities/versioning-service';
import { logout } from '@/use/logout';


export async function updateProject () {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const authErrors = PARAMETERS.AUTH_ERROR_CODES;

    await notificationService.showProgressDialog(
        labels.wait,
        labels.updating_project
    );

    versioningService.updateProject().then(
        function (changeMade) {
            notificationService.hideProgressDialog(0);

            // If new questions have been added, notify user
            if (changeMade) {
                // If a change has been made, we should set the next route as the project-entries page
                rootStore.nextRoute = PARAMETERS.ROUTES.ENTRIES;

                notificationService.showAlert(STRINGS[language].status_codes.ec5_137);
            } else {
                notificationService.showAlert(STRINGS[language].status_codes.ec5_136);
            }
        },
        async function (error) {
            console.log(error);
            notificationService.hideProgressDialog();
            // Web error
            console.log('fail');
            // Check if we have an auth error
            if (authErrors.indexOf(error?.data?.errors[0]?.code) >= 0) {
                notificationService.showAlert(
                    STRINGS[language].status_codes[error.data.errors[0].code]
                );
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
                errorsService.handleWebError(error);
            }
        }
    );
}
