// noinspection DuplicatedCode

import {notificationService} from '@/services/notification-service';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {databaseInsertService} from '@/services/database/database-insert-service';
import {utilsService} from '@/services/utilities/utils-service';
import {rollbarService} from '@/services/utilities/rollbar-service';
import { useRootStore } from '@/stores/root-store';

export async function cloneEntry(state, router) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;


    //if entry is incomplete, bail out
    if (state.entry.synced === PARAMETERS.SYNCED_CODES.INCOMPLETE) {
        await notificationService.showAlert(labels.cannot_clone_incomplete_entry);
        return;
    }

    //if entry has errors, bail out
    if(state.entry.synced === PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR){
        await notificationService.showAlert(labels.cannot_clone_entry_with_errors);
        return;
    }

    const confirmed = await notificationService.confirmSingle(
        STRINGS[language].status_codes.ec5_393
    );

    if (confirmed) {
        // Clone the entry
        await notificationService.showProgressDialog(labels.wait);
        try {
            const clonedEntry = utilsService.generateCloneEntry(state.entry);
            await databaseInsertService.insertCloneEntry(clonedEntry);
            notificationService.showToast(labels.entry_cloned);
            router.replace({
                name: PARAMETERS.ROUTES.ENTRIES,
                query: {
                    refreshEntries: true,
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            // Handle error if the insert fails
            console.error(error);
            rollbarService.critical(error);
            await notificationService.showAlert(
                error?.message || labels.unknown_error
            );
            notificationService.hideProgressDialog();
        }
    }
}
