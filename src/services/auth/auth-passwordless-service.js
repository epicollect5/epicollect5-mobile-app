import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { webService } from '@/services/web-service';

export const authPasswordlessService = {

    async getCode (email) {

        const rootStore = useRootStore();
        const language = rootStore.language;

        return new Promise((resolve, reject) => {

            if (!email) {
                reject('ec5_42');
            }
            (async () => {
                // Check if we have a connection
                const hasInternetConnection = await utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    reject('ec5_118');
                } else {
                    await notificationService.showProgressDialog(STRINGS[language].labels.wait + '...');

                    webService.getPasswordlessCode(email).then(
                        function (response) {
                            notificationService.hideProgressDialog();
                            console.log(response);

                            if (response.data.data.code === 'ec5_372') {

                                resolve();
                                //todo:
                                //open modal to enter code
                                //  $scope.passwordless.code = null;
                                //   $rootStore.passwordlessLoginModal.show();
                            }
                            else {
                                notificationService.hideProgressDialog();
                                const errorCode = errorsService.getWebErrorCode(response);
                                reject(errorCode);
                            }
                        },
                        function (response) {
                            notificationService.hideProgressDialog();
                            const errorCode = errorsService.getWebErrorCode(response);
                            reject(errorCode);
                        });
                }
            })();
        });
    },
    async authPasswordlessUser (credentials) {

        const rootStore = useRootStore();
        const language = rootStore.language;

        return new Promise((resolve, reject) => {
            (async () => {
                // Check if we have a connection
                const hasInternetConnection = await utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    reject('ec5_118');
                } else {
                    await notificationService.showProgressDialog(STRINGS[language].labels.sign_in + '...');

                    webService.passwordlessLogin(credentials).then(
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

