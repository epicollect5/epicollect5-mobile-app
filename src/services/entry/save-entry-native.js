import {PARAMETERS} from '@/config';
import {notificationService} from '@/services/notification-service';
import {questionCommonService} from '@/services/entry/question-common-service';
import {errorsService} from '@/services/errors-service';
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings';

export async function saveEntryNative(state, syncType, quit) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    // Determine the syncType
    syncType = syncType ?? PARAMETERS.SYNCED_CODES.UNSYNCED;

    //single-flight latch: ignore replays while a save is in flight or
    //success-pending-navigation (second tap would re-move consumed temp files)
    if (state.isSavingEntry) {
        return;
    }
    state.isSavingEntry = true;

    // SAVE ENTRY
    try {
        await notificationService.showProgressDialog(labels.wait, labels.saving);
        await rootStore.entriesAddScope.entryService.saveEntry(syncType);
        // Quit with navigation params
        quit(questionCommonService.getNavigationParams(rootStore.entriesAddScope.entryService));
    } catch (error) {
        console.log(error);
        //allow retry after a genuine failure
        state.isSavingEntry = false;
        // An error occurred
        await notificationService.hideProgressDialog();
        if (error.error && state.error) {
            await errorsService.handleEntryErrors(error.error, state.error, error.inputRefs);
        } else {
            //db errors are {code:0, message:'something'}
            if (error.message) {
                await notificationService.showAlert(error.message, labels.error);
            } else {
                await notificationService.showAlert(error, labels.error);
            }
        }
    }
}
