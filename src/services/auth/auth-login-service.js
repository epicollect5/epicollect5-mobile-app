import { STRINGS } from '@/config/strings';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { useRootStore } from '@/stores/root-store';

export const authLoginService = {
    getGoogleCodeNatively (authIds) {
        return new Promise((resolve, reject) => {
            // Cordova googleplus plugin
            window.plugins.googleplus.login(
                {
                    webClientId: authIds.google.CLIENT_ID, // optional clientId of your Web application from Credentials settings of your project - On Android, this MUST be included to get an idToken. On iOS, it is not required.
                    offline: true // optional, but requires the webClientId - if set to true the plugin will also return a serverAuthCode, which can be used to grant offline access to a non-Google server
                },
                function (response) {
                    console.log(response);
                    //Post google access code to server and retrieve jwt
                    if (response.serverAuthCode) {
                        resolve({
                            code: response.serverAuthCode,
                            email: response.email,
                            family_name: response.familyName,
                            given_name: response.givenName
                        });
                    } else {
                        reject();
                    }
                },
                function (error) {
                    console.log(error);
                    reject();
                }
            );
        });
    },
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
        if (response?.data?.data?.jwt) {
            return true;
        } else {
            // Invalid json response
            return false;
        }
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
                resolve({
                    name: name,
                    email: email
                });
            }, () => {
                reject('ec5_12');
            });
        });
    }
};

