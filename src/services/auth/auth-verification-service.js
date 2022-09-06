import * as services from '@/services';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';

export const authVerificationService = {

    async verifyUser (credentials) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        return new Promise((resolve, reject) => {
            (async () => {
                // Check if we have a connection
                const hasInternetConnection = await services.utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    services.notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
                } else {
                    await services.notificationService.showProgressDialog(STRINGS[language].labels.sign_in + '...');

                    //verify user
                    services.webService.verifyUserEmail(credentials).then(
                        (response) => {
                            resolve(response);
                        },
                        (response) => {
                            services.notificationService.hideProgressDialog();
                            const errorCode = services.errorsService.getWebErrorCode(response);
                            reject(errorCode);
                        });
                }
            })();
        });
    }
};