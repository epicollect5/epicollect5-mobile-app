import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { SocialLogin } from '@capgo/capacitor-social-login';

export async function logout() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    function _resetStoredUser() {
        rootStore.user = {
            action: labels.login,
            name: '',
            email: ''
        };
    }

    return new Promise((resolve) => {
        databaseDeleteService.deleteToken().then(() => {
            if (rootStore.device.platform !== PARAMETERS.WEB) {
                // Logout from all social providers in parallel
                const logoutPromises = [
                    SocialLogin.logout({ provider: 'google' }),
                    SocialLogin.logout({ provider: 'apple' })
                ];

                Promise.allSettled(logoutPromises)
                    .then((results) => {
                        results.forEach((result) => {
                            if (result.status === 'fulfilled') {
                                console.log('Logout success:', result.value);
                            } else {
                                console.error('Logout error:', result.reason);
                            }
                        });

                        _resetStoredUser();
                        resolve();
                    });
            } else {
                _resetStoredUser();
                resolve();
            }
        });
    });
}

