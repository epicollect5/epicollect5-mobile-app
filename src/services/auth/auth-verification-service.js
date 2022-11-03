import { STRINGS } from '@/config/strings';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { webService } from '@/services/web-service';
import { useRootStore } from '@/stores/root-store';

export const authVerificationService = {

    async verifyUser (credentials) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        return new Promise((resolve, reject) => {
            (async () => {
                // Check if we have a connection
                const hasInternetConnection = await utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
                } else {
                    await notificationService.showProgressDialog(STRINGS[language].labels.sign_in + '...');

                    //verify user
                    webService.verifyUserEmail(credentials).then(
                        (response) => {
                            resolve(response);
                        },
                        (response) => {
                            notificationService.hideProgressDialog();
                            const errorCode = errorsService.getWebErrorCode(response);
                            reject(errorCode);
                        });
                }
            })();
        });
    }
};