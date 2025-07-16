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
import { SocialLogin } from '@capgo/capacitor-social-login';

export const authGoogleService = {

    //Native login using cordova https://goo.gl/vRuudH
    async getGoogleCodeNatively (authIds) {

        await SocialLogin.initialize({
            google: {
                webClientId: authIds.google.CLIENT_ID,
                iOSClientId: authIds.google.IOS_CLIENT_ID,
                iOSServerClientId: authIds.google.CLIENT_ID,//same as webClientId
                mode: 'offline' // <-- important, we need serverAuthCode
            }
        });

        return new Promise(function (resolve, reject) {

            SocialLogin.login({
                provider: 'google',
                mode: 'offline',
                options: {}
            }).then(
                (response) => {
                    console.log(response);
                    //Post google access code to server and retrieve jwt
                    if (response.result.serverAuthCode) {
                        resolve({
                            code: response.result.serverAuthCode
                        });
                    } else {
                        reject();
                    }
                },
                (error) => {
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
            await notificationService.showAlert(STRINGS[language].status_codes.ec5_118);
        } else {

            await notificationService.showProgressDialog(labels.sign_in + '...');

            this.getGoogleCodeNatively(authIds).then(
                function (googleResponse) {
                    console.log('googleResponse', googleResponse);
                    account.code = googleResponse.code;

                    webService.authGoogleUser(googleResponse.code).then(
                        async function (response) {
                            console.log('response', response);

                            //Google user is authenticated, save to store
                            try {
                                const user = await authLoginService.loginUser(response);
                                account.email = user.email;
                                account.provider = PARAMETERS.PROVIDERS.GOOGLE;
                                account.name = user.name;
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
                                await notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
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
                                await errorsService.handleWebError(error);
                            }
                        });
                }, function (error) {
                    //t.ly/wlpO => SIGN IN CANCELLED gets code 12501
                    if (error !== '12501') {
                        notificationService.showAlert(STRINGS[language].status_codes.ec5_103, labels.error + ' ' + error);
                    }
                    notificationService.hideProgressDialog();
                });
        }
    }
};
