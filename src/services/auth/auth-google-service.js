import * as services from '@/services';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { modalController } from '@ionic/vue';
import ModalConfirmPassword from '@/components/modals/ModalConfirmPassword.vue';
import ModalConfirmEmail from '@/components/modals/ModalConfirmEmail.vue';

export const authGoogleService = {

    //Native login using cordova https://goo.gl/vRuudH
    getGoogleCodeNatively (authIds) {
        return new Promise(function (resolve, reject) {

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
    async authGoogleUser (authIds) {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const account = {};

        // Check if we have a connection
        const hasInternetConnection = await services.utilsService.hasInternetConnection();
        if (!hasInternetConnection) {
            services.notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
        } else {

            await services.notificationService.showProgressDialog(STRINGS[language].labels.sign_in + '...');

            this.getGoogleCodeNatively(authIds).then(
                function (googleResponse) {
                    account.email = googleResponse.email;
                    account.provider = PARAMETERS.PROVIDERS.GOOGLE;
                    account.user = {
                        given_name: googleResponse.given_name,
                        family_name: googleResponse.family_name
                    };

                    services.webService.authGoogleUser(googleResponse.code).then(
                        async function (response) {
                            console.log('response', response);

                            //Google user is authenticated, save to store
                            try {
                                await services.authLoginService.loginUser(response);
                                services.modalsHandlerService.dismissAll();
                                services.notificationService.showToast(STRINGS[language].status_codes.ec5_115);

                                //any extra action to perform? (like addProject()...)
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
                                    rootStore.afterUserIsLoggedIn = { callback: null, params: null };
                                }
                                else {
                                    services.notificationService.hideProgressDialog();
                                }
                            } catch (errorCode) {
                                services.notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
                                services.notificationService.hideProgressDialog();
                            }
                        },
                        async function (error) {
                            console.log(error);
                            //clashing accounts?
                            const errors = error.data.errors;
                            if (errors[0].code === 'ec5_383') {
                                account.code = null;
                                //need to confirm email
                                services.webService.getEmailConfirmationCode(account.email).then(async function () {
                                    services.notificationService.hideProgressDialog();
                                    //show form to enter code
                                    services.modalsHandlerService.confirmEmail = await modalController.create({
                                        cssClass: 'modal-confirm-email',
                                        component: ModalConfirmEmail,
                                        showBackdrop: true,
                                        backdropDismiss: false,
                                        componentProps: {
                                            account
                                        }
                                    });

                                    services.modalsHandlerService.confirmEmail.onDidDismiss().then((response) => {
                                        console.log('is', response.data);
                                    });
                                    return services.modalsHandlerService.confirmEmail.present();

                                }, function (error) {
                                    console.log(error);
                                    // hide all auth modals
                                    services.modalsHandlerService.dismissAll();
                                    services.notificationService.hideProgressDialog();
                                    services.errorsService.handleWebError(error);
                                });
                            }

                            if (errors[0].code === 'ec5_390') {
                                //need to confirm password
                                services.notificationService.hideProgressDialog();
                                //show modal to enter password
                                services.modalsHandlerService.confirmPassword = await modalController.create({
                                    cssClass: 'modal-confirm-password',
                                    component: ModalConfirmPassword,
                                    showBackdrop: true,
                                    backdropDismiss: false,
                                    componentProps: {
                                        email: account.email
                                    }
                                });

                                services.modalsHandlerService.confirmPassword.onDidDismiss().then((response) => {
                                    console.log('is', response.data);
                                });
                                return services.modalsHandlerService.confirmPassword.present();
                            }

                            if (errors[0].code !== 'ec5_390' && errors[0].code !== 'ec5_383') {
                                // hide any modals
                                services.modalsHandlerService.dismissAll();
                                services.notificationService.hideProgressDialog();
                                services.errorsService.handleWebError(error);
                            }

                        });
                }, function () {
                    // If we got no response, it was probably a cordova inappbrowser loaderror
                    services.notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
                    services.notificationService.hideProgressDialog();
                });
        }
    }
};