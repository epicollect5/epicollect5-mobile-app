import { STRINGS } from '@/config/strings';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { useRootStore } from '@/stores/root-store';
import {modalsHandlerService} from '@/services/modals/modals-handler-service';
import {notificationService} from '@/services/notification-service';

export const authLoginService = {

    storeUser (jwt, name, email) {
        return new Promise((resolve, reject) => {
            // Check we were given a jwt string
            if (jwt) {
                databaseInsertService.insertUser(jwt, name, email).then(
                    function () {
                        resolve();
                    },
                    function (error) {
                        reject(error);
                    });
            } else {
                reject();
            }
        });
    },
    validateResponse (response) {
        return !!response?.data?.data?.jwt;
    },
    async loginUser (response) {
        const rootStore = useRootStore();
        const language = rootStore.language;
        return new Promise((resolve, reject) => {

            const jwt = response.data.data?.jwt;
            const name = response.data.meta?.user?.name || '';
            const email = response.data.meta?.user?.email || '';

            this.storeUser(jwt, name, email).then(() => {
                //set user details in store
                rootStore.user = {
                    name: name,
                    email: email,
                    action: STRINGS[language].labels.logout
                };
                resolve();
            }, () => {
                reject('ec5_12');
            });
        });
    },

    //Run the action parked for after a successful login (if any) and clear it.
    //Every login flow (google, apple, passwordless, confirm email, local) ends
    //here, so the parked action has exactly one consumer
    async runAfterLoginAction (rootStore) {
        const {callback, params} = rootStore.afterUserIsLoggedIn;

        if (!callback) {
            await notificationService.hideProgressDialog();
            return false;
        }

        try {
            if (params) {
                await callback(...params);
            } else {
                //callback will be async updateLocalProject()
                await callback();
            }
        } finally {
            //always clear: a callback that rejects must not leave a stale action
            //behind to run on an unrelated later login
            rootStore.afterUserIsLoggedIn = {callback: null, params: null};
        }

        return true;
    },

    async onAuthSuccess(response, language, rootStore) {
        try {
            await authLoginService.loginUser(response);
            await modalsHandlerService.dismissAll();
            notificationService.showToast(STRINGS[language].status_codes.ec5_115);

            //any extra action to perform? (like addProject()...)
            await authLoginService.runAfterLoginAction(rootStore);
        } catch (errorCode) {
            await notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
            await notificationService.hideProgressDialog();
        }
    }
};

