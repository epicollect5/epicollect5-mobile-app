import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import * as services from '@/services';

export async function loginLocal (credentials) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    await services.notificationService.showProgressDialog(labels.sign_in + '...');
    //try to authenticate user
    try {
        await services.authLocalService.authLocalUser(credentials);

        services.notificationService.showToast(STRINGS[language].status_codes.ec5_115);
        //user is logged in, dismiss all modals related to auth
        services.modalsHandlerService.dismissAll();

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
            services.notificationService.hideProgressDialog();
        }
    } catch (errorCode) {
        //show error to user
        services.notificationService.showAlert(STRINGS[language].status_codes[errorCode]);
        services.notificationService.hideProgressDialog();
    }
    services.notificationService.hideProgressDialog();
}