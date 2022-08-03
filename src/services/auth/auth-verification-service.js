import * as services from '@/services';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';

export const authVerificationService = {

    async verifyUser (credentials) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        // Check if we have a connection
        const hasInternetConnection = await services.utilsService.hasInternetConnection();
        if (!hasInternetConnection) {
            services.notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
        } else {
            await services.notificationService.showProgressDialog(STRINGS[language].labels.sign_in + '...');

            //verify user
            services.webService.verifyUserEmail(credentials).then(
                async function (response) {
                    try {
                        //all good, log user in
                        await services.authLoginService.loginUser(response);
                        services.modalsHandlerService.dismissAll();
                        services.notificationService.hideProgressDialog();
                        services.notificationService.showToast(STRINGS[language].status_codes.ec5_115);
                    }
                    catch (errorCode) {
                        services.notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
                    }
                },
                function (error) {
                    services.notificationService.hideProgressDialog();
                    services.errorsService.handleWebError(error);
                    services.modalsHandlerService.confirmEmail.dismiss();
                });
        }
    }
};