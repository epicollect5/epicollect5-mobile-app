import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { modalController } from '@ionic/vue';
import ModalConfirmPassword from '@/components/modals/ModalConfirmPassword.vue';
import ModalConfirmEmail from '@/components/modals/ModalConfirmEmail.vue';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { webService } from '@/services/web-service';
import { authLoginService } from '@/services/auth/auth-login-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';

export const authAppleService = {
    //auth Apple user on iOS 13+
    async authAppleUser () {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const account = {};
        let appleJwtToken;

        // Check if we have a connection
        const hasInternetConnection = await utilsService.hasInternetConnection();
        if (!hasInternetConnection) {
            notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
        } else {
            window.cordova.plugins.SignInWithApple.signin(
                { requestedScopes: [0, 1] },
                async function (response) {

                    await notificationService.showProgressDialog(STRINGS[language].labels.sign_in + '...');

                    appleJwtToken = response.identityToken;

                    //fullName is the user object from the response, like we have on the web JS sign in flow. Do not know if the plugin or Apple is not consistent with property names...
                    webService.authAppleUser(appleJwtToken, response.fullName).then(async function (response) {
                        try {
                            await authLoginService.loginUser(response);
                            modalsHandlerService.dismissAll();
                            notificationService.showToast(STRINGS[language].status_codes.ec5_115);

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
                                notificationService.hideProgressDialog();
                            }
                        } catch (errorCode) {
                            notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
                            notificationService.hideProgressDialog();
                        }
                    },
                        async function (error) {
                            console.log(error);
                            //clashing accounts?
                            const errors = error.data.errors;
                            const credentials = window.jwt_decode(appleJwtToken);
                            if (errors[0].code === 'ec5_384') {
                                //need to confirm email
                                account.code = null;
                                webService.getEmailConfirmationCode(credentials.email).then(async function () {
                                    notificationService.hideProgressDialog();
                                    account.email = credentials.email;
                                    account.provider = PARAMETERS.PROVIDERS.APPLE;

                                    notificationService.hideProgressDialog();
                                    //show form to enter code
                                    modalsHandlerService.confirmEmail = await modalController.create({
                                        cssClass: 'modal-confirm-email',
                                        component: ModalConfirmEmail,
                                        showBackdrop: true,
                                        backdropDismiss: false,
                                        componentProps: {
                                            account
                                        }
                                    });

                                    modalsHandlerService.confirmEmail.onDidDismiss().then((response) => {
                                        console.log('is', response.data);
                                    });
                                    return modalsHandlerService.confirmEmail.present();
                                }, function (error) {
                                    console.log(error);
                                    // hide all auth modals
                                    modalsHandlerService.dismissAll();
                                    notificationService.hideProgressDialog();
                                    errorsService.handleWebError(error);
                                });
                            }

                            if (errors[0].code === 'ec5_390') {
                                //need to confirm password
                                notificationService.hideProgressDialog();
                                //show modal to enter password
                                modalsHandlerService.confirmPassword = await modalController.create({
                                    cssClass: 'modal-confirm-password',
                                    component: ModalConfirmPassword,
                                    showBackdrop: true,
                                    backdropDismiss: false,
                                    componentProps: {
                                        email: account.email
                                    }
                                });

                                modalsHandlerService.confirmPassword.onDidDismiss().then((response) => {
                                    console.log('is', response.data);
                                });
                                return modalsHandlerService.confirmPassword.present();
                            }

                            if (errors[0].code !== 'ec5_390' && errors[0].code !== 'ec5_384') {
                                // hide any modals
                                modalsHandlerService.dismissAll();
                                notificationService.hideProgressDialog();
                                errorsService.handleWebError(error);
                            }
                        });
                },
                function (error) {
                    console.error(error);
                    console.log(JSON.stringify(error));
                    notificationService.hideProgressDialog();
                    // If we got no response, it was probably a cordova inappbrowser loaderror
                    notificationService.showToast(STRINGS[language].status_codes.ec5_103);
                }
            );
        }
    }
};