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
                    reject(error);
                }
            );
        });
    },
    async authGoogleUser (authIds) {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const account = {};

        // Check if we have a connection
        const hasInternetConnection = await utilsService.hasInternetConnection();
        if (!hasInternetConnection) {
            notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
        } else {

            await notificationService.showProgressDialog(labels.sign_in + '...');

            this.getGoogleCodeNatively(authIds).then(
                function (googleResponse) {
                    account.email = googleResponse.email;
                    account.provider = PARAMETERS.PROVIDERS.GOOGLE;
                    account.user = {
                        given_name: googleResponse.given_name,
                        family_name: googleResponse.family_name
                    };

                    webService.authGoogleUser(googleResponse.code).then(
                        async function (response) {
                            console.log('response', response);

                            //Google user is authenticated, save to store
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
                            if (errors[0].code === 'ec5_383') {
                                account.code = null;
                                //need to confirm email
                                webService.getEmailConfirmationCode(account.email).then(async function () {
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

                            if (errors[0].code !== 'ec5_390' && errors[0].code !== 'ec5_383') {
                                // hide any modals
                                modalsHandlerService.dismissAll();
                                notificationService.hideProgressDialog();
                                errorsService.handleWebError(error);
                            }

                        });
                }, function (error) {
                    //t.ly/wlpO => SIGN IN CANCELLED gets code 12501
                    if (error != '12501') {
                        notificationService.showAlert(STRINGS[language].status_codes.ec5_103, labels.error + ' ' + error);
                    }
                    notificationService.hideProgressDialog();
                });
        }
    }
};