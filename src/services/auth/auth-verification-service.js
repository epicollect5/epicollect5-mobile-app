import { STRINGS } from '@/config/strings';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { webService } from '@/services/web-service';
import { useRootStore } from '@/stores/root-store';
import { jwtDecode } from 'jwt-decode';
import {databaseSelectService} from '@/services/database/database-select-service';

export const authVerificationService = {

    async verifyUser (credentials) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        return new Promise((resolve, reject) => {
            (async () => {
                // Check if we have a connection
                const hasInternetConnection = await utilsService.hasInternetConnection();
                if (!hasInternetConnection) {
                    await notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
                    reject('ec5_118');
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
    },

    async isJWTExpired() {
        try {
            const res = await databaseSelectService.getUser();

            if (res.rows.length > 0) {
                const jwt = res.rows.item(0).jwt;

                // 1. Decode using the library
                const decoded = jwtDecode(jwt);

                // 2. Check for the 'exp' claim
                if (!decoded.exp) {
                    return true;
                }

                // 3. Compare with current time (add 10s clock-skew buffer)
                const currentTime = Date.now() / 1000;
                return decoded.exp < (currentTime + 10);
            }

            return true;
        } catch (error) {
            // If jwtDecode throws (e.g., invalid format), it lands here
            console.error('JWT check failed', error);
            return true;
        }
    }
};
