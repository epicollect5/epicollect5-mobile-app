import { menuController, modalController } from '@ionic/vue';
import ModalLogin from '@/components/modals/ModalLogin';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { webService } from '@/services/web-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';


export function showModalLogin () {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    webService.getLoginMethods().then(
        async function (response) {

            //if it fails (wrong server url for example) bail out
            if (!Array.isArray(response?.data?.data?.login?.methods)) {
                notificationService.hideProgressDialog();
                notificationService.showAlert(STRINGS[language].status_codes.ec5_142);
                return false;
            }

            const authMethods = response.data.data.login.methods;
            const authIds = {
                google: {
                    CLIENT_ID: process.env.VUE_APP_GOOGLE_CLIENT_ID_WEB,
                    SCOPE: process.env.VUE_APP_GOOGLE_SIGNIN_SCOPE
                }
            };

            rootStore.user = {
                name: '',
                email: '',
                action: labels.login
            };

            notificationService.hideProgressDialog();

            // Show login modal
            modalsHandlerService.login = await modalController.create({
                cssClass: 'modal-login',
                component: ModalLogin,
                showBackdrop: true,
                backdropDismiss: false,
                componentProps: {
                    authMethods,
                    authIds
                }
            });

            modalsHandlerService.login.onDidDismiss().then((response) => {
                console.log('is modalLogin', response.data);
            });

            menuController.close();
            return modalsHandlerService.login.present();
        },
        function (response) {
            notificationService.hideProgressDialog();
            errorsService.handleWebError(response);
        }
    );
}