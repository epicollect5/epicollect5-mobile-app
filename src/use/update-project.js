import * as services from '@/services';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { showModalLogin } from '@/use/show-modal-login';

export async function updateProject () {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const authErrors = PARAMETERS.AUTH_ERROR_CODES;

    await services.notificationService.showProgressDialog(
        labels.wait,
        labels.updating_project
    );

    services.versioningService.updateProject().then(
        function (changeMade) {
            services.notificationService.hideProgressDialog(0);

            // If new questions have been added, notify user
            if (changeMade) {
                // If a change has been made, we should set the next route as the project-entries page
                rootStore.nextRoute = PARAMETERS.ROUTES.ENTRIES;

                services.notificationService.showAlert(STRINGS[language].status_codes.ec5_137);
            } else {
                services.notificationService.showAlert(STRINGS[language].status_codes.ec5_136);
            }
        },
        function (error) {
            console.log(error);
            services.notificationService.hideProgressDialog();
            // Web error
            console.log('fail');
            // Check if we have an auth error
            if (authErrors.indexOf(error?.data?.errors[0]?.code) >= 0) {
                services.notificationService.showAlert(
                    STRINGS[language].status_codes[error.data.errors[0].code]
                );
                //1 - set a callback to add the project after logging in
                rootStore.afterUserIsLoggedIn = {
                    callback: updateProject,
                    params: null
                };
                //2- Ask user to login
                showModalLogin();
            } else {
                // Other error
                services.errorsService.handleWebError(error);
            }
        }
    );
}
