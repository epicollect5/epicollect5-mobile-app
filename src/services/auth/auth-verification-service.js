import { STRINGS } from '@/config/strings';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { webService } from '@/services/web-service';
import { useRootStore } from '@/stores/root-store';
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
                const parts = jwt.split('.');
                if (parts.length !== 3) {
                    return true; // Malformed JWT, treat as expired
                }
                const payload = parts[1];

                const base64Url = payload.replace(/-/g, '+').replace(/_/g, '/');
                // Restore padding so atob() doesn't throw in strict environments
                const base64 = base64Url.padEnd(base64Url.length + (4 - base64Url.length % 4) % 4, '=');
                // 2. Decode and Parse
                const jwtDecoded = JSON.parse(window.atob(base64));

                // 3. No exp claim → treat as expired
                if (jwtDecoded.exp === undefined || jwtDecoded.exp === null) {
                    return true;
                }

                // 4. Return expiry status with a 10s clock-skew buffer
                return jwtDecoded.exp < (Date.now() / 1000) + 10;
            }
            return true; // No user, treat as expired
        } catch (error) {
            console.error('JWT check failed', error);
            return true;
        }
    }
};
