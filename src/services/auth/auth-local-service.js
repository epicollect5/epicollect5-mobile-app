import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { webService } from '@/services/web-service';
import { authLoginService } from '@/services/auth/auth-login-service';


export const authLocalService = {
    async authLocalUser (credentials) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        return new Promise((resolve, reject) => {

            (async () => {
                // Check if we have a connection
                const hasInternetConnection = await utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    //"no network" error
                    reject(STRINGS[language].status_codes.ec5_118);
                }
                //attempt login
                try {
                    const authResponse = await webService.login(credentials, 'local');
                    const isValidResponse = authLoginService.validateResponse(authResponse);

                    if (!isValidResponse) {
                        reject('ec5_210');
                    }
                    try {
                        await authLoginService.loginUser(authResponse);
                        resolve();
                    }
                    catch (errorCode) {
                        reject(errorCode);
                    }
                }
                catch (response) {
                    const errorCode = errorsService.getWebErrorCode(response);
                    reject(errorCode);
                }
            })();
        });
    }
};
