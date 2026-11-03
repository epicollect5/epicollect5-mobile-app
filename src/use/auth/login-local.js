import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { notificationService } from '@/services/notification-service';
import { authLocalService } from '@/services/auth/auth-local-service';
import { authLoginService } from '@/services/auth/auth-login-service';
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
        await modalsHandlerService.dismissAll();

        //any extra action to perform? (like addProject()...)
        await authLoginService.runAfterLoginAction(rootStore);
    } catch (errorCode) {
        //show error to user
        await notificationService.showAlert(STRINGS[language].status_codes[errorCode]);
        await notificationService.hideProgressDialog();
    }
    await notificationService.hideProgressDialog();
}
