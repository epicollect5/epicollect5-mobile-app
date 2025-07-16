import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {databaseDeleteService} from '@/services/database/database-delete-service';

export async function logout() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    function _resetStoredUser() {
        rootStore.user = {
            action: labels.login, name: '', email: ''
        };
    }

    return new Promise((resolve) => {
        //log out by deleting the user token on the device
        databaseDeleteService.deleteToken().then(() => {
            //reset user in store to update UI
            _resetStoredUser();
            resolve();
        });
    });
}

