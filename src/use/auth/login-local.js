import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { notificationService } from '@/services/notification-service';
import { authLocalService } from '@/services/auth/auth-local-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';

export async function loginLocal (credentials) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    await notificationService.showProgressDialog(labels.sign_in + '...');
    //try to authenticate user
    try {
        await authLocalService.authLocalUser(credentials);

        notificationService.showToast(STRINGS[language].status_codes.ec5_115);
        //user is logged in, dismiss all modals related to auth
        modalsHandlerService.dismissAll();

        //any extra action to perform? (like addProject()...)
        if (rootStore.afterUserIsLoggedIn.callback !== null) {
            const callback = rootStore.afterUserIsLoggedIn.callback;
            const params = rootStore.afterUserIsLoggedIn.params;
            if (params) {
                await callback(...params);
            } else {
                await callback();
            }
            //reset callback
            rootStore.afterUserIsLoggedIn = { callback: null, params: null };
        }
        else {
            notificationService.hideProgressDialog();
        }
    } catch (errorCode) {
        //show error to user
        notificationService.showAlert(STRINGS[language].status_codes[errorCode]);
        notificationService.hideProgressDialog();
    }
    notificationService.hideProgressDialog();
}