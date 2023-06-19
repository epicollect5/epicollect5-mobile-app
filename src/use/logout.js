import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

export async function logout () {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    function _resetStoredUser () {
        rootStore.user = {
            action: labels.login,
            name: '',
            email: ''
        };
    }

    return new Promise((resolve) => {
        // Delete the current token
        databaseDeleteService.deleteToken().then(function () {
            if (rootStore.device.platform !== PARAMETERS.WEB) {
                // Attempt to logout google user
                try {
                    GoogleAuth.signOut().then(
                        async function () {
                            _resetStoredUser();
                            resolve();
                        },
                        function (error) {
                            _resetStoredUser();
                            // If it failed, they weren't logged in to Google, so just call afterLogout and resolve
                            resolve();
                        }
                    );
                }
                catch (error) {
                    console.log(error);
                    resolve();
                }

                //todo: logout apple user?
            } else {
                _resetStoredUser();
                resolve();
            }
        });
    });


}