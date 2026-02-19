import {PARAMETERS} from '@/config';
import {notificationService} from '@/services/notification-service';
import {questionCommonService} from '@/services/entry/question-common-service';
import {errorsService} from '@/services/errors-service';
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings';

export async function saveEntryNative (state, syncType, quit) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    // Determine the syncType
    syncType = syncType ? syncType : PARAMETERS.SYNCED_CODES.UNSYNCED;

    await notificationService.showProgressDialog(labels.wait, labels.saving);
    // SAVE ENTRY
    rootStore.entriesAddScope.entryService.saveEntry(syncType).then(
        function () {
            // Quit with navigation params
            quit(questionCommonService.getNavigationParams(rootStore.entriesAddScope.entryService));
        },
        function (error) {
            console.log(error);
            // An error occurred
            notificationService.hideProgressDialog();
            if (error.error && state.error) {
                errorsService.handleEntryErrors(error.error, state.error, error.inputRefs);
            } else {
                //db errors are {code:0, message:'something'}
                if (error.message) {
                    notificationService.showAlert(error.message, labels.error);
                } else {
                    notificationService.showAlert(error, labels.error);
                }
            }
        }
    );
}
