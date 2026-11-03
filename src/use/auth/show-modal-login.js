import { menuController, modalController } from '@ionic/vue';
import ModalLogin from '@/components/modals/ModalLogin.vue';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { webService } from '@/services/web-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';

export function showModalLogin() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    //no login session was established: drop any action parked for after a successful
    //login, otherwise a later login from an unrelated page would run it
    function dropAfterUserIsLoggedInAction () {
        rootStore.afterUserIsLoggedIn = {callback: null, params: null};
    }
    webService.getLoginMethods().then(
        async function (response) {

            //if it fails (wrong server url for example) bail out
            if (!Array.isArray(response?.data?.data?.login?.methods)) {
                dropAfterUserIsLoggedInAction();
                await notificationService.hideProgressDialog();
                await notificationService.showAlert(STRINGS[language].status_codes.ec5_142);
                return false;
            }

            const authMethods = response.data.data.login.methods;
            const authIds = {
                google: {
                    CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID_WEB,
                    SCOPE: import.meta.env.VITE_GOOGLE_SIGNIN_SCOPE
                }
            };

            rootStore.user = {
                name: '',
                email: '',
                action: labels.login
            };

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
                //a completed login keeps its parked action: onAuthSuccess stores the
                //user before dismissing the modal, so an empty email means the flow
                //was abandoned and nothing may run on a later login
                if (!rootStore.user?.email) {
                    dropAfterUserIsLoggedInAction();
                }
            });

            menuController.close();
            //release the loader only now, in the same tick as the present: hiding it
            //before the modal existed left a navigable window (the getLoginMethods
            //round-trip plus the creation) where the user could change page, and the
            //login modal then landed on an unrelated one
            await notificationService.hideProgressDialog(0);
            return modalsHandlerService.login.present();
        },
        async function (response) {
            dropAfterUserIsLoggedInAction();
            await notificationService.hideProgressDialog();
            await errorsService.handleWebError(response);
        }
    );
}
