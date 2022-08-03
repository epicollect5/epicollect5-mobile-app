import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import * as services from '@/services';


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
                const hasInternetConnection = await services.utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    reject('ec5_118');
                } else {
                    await services.notificationService.showProgressDialog(STRINGS[language].labels.wait + '...');

                    services.webService.getPasswordlessCode(email).then(
                        function (response) {
                            services.notificationService.hideProgressDialog();
                            console.log(response);

                            if (response.data.data.code === 'ec5_372') {

                                resolve();
                                //todo:
                                //open modal to enter code
                                //  $scope.passwordless.code = null;
                                //   $rootStore.passwordlessLoginModal.show();
                            }
                            else {
                                services.notificationService.hideProgressDialog();
                                const errorCode = services.errorsService.getWebErrorCode(response);
                                reject(errorCode);
                            }
                        },
                        function (response) {
                            services.notificationService.hideProgressDialog();
                            const errorCode = services.errorsService.getWebErrorCode(response);
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
                const hasInternetConnection = await services.utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    reject('ec5_118');
                } else {
                    await services.notificationService.showProgressDialog(STRINGS[language].labels.sign_in + '...');

                    services.webService.passwordlessLogin(credentials).then(
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

