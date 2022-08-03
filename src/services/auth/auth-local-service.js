import * as services from '@/services';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';


export const authLocalService = {
    async authLocalUser (credentials) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        return new Promise((resolve, reject) => {

            (async () => {
                // Check if we have a connection
                const hasInternetConnection = await services.utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    //"no network" error
                    reject(STRINGS[language].status_codes.ec5_118);
                }
                //attempt login
                try {
                    const authResponse = await services.webService.login(credentials, 'local');
                    const isValidResponse = services.authLoginService.validateResponse(authResponse);

                    if (!isValidResponse) {
                        reject('ec5_210');
                    }
                    try {
                        await services.authLoginService.loginUser(authResponse);
                        resolve();
                    }
                    catch (errorCode) {
                        reject(errorCode);
                    }
                }
                catch (response) {
                    const errorCode = services.errorsService.getWebErrorCode(response);
                    reject(errorCode);
                }
            })();
        });
    }
};
