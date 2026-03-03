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

    async onAuthSuccess(response, language, rootStore) {
        try {
            await authLoginService.loginUser(response);
            modalsHandlerService.dismissAll();
            notificationService.showToast(STRINGS[language].status_codes.ec5_115);

            //any extra action to perform? (like addProject()...)
            // noinspection DuplicatedCode
            if (rootStore.afterUserIsLoggedIn.callback !== null) {
                const callback = rootStore.afterUserIsLoggedIn.callback;
                const params = rootStore.afterUserIsLoggedIn.params;
                if (params) {
                    await callback(...params);
                } else {
                    //callback will be async updateLocalProject()
                    await callback();
                }
                //reset callback
                rootStore.afterUserIsLoggedIn = {callback: null, params: null};
            } else {
                notificationService.hideProgressDialog();
            }
        } catch (errorCode) {
            await notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
            notificationService.hideProgressDialog();
        }
    }
};

