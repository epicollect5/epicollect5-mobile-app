import {projectModel} from '@/models/project-model';
import {notificationService} from '@/services/notification-service';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {databaseInsertService} from '@/services/database/database-insert-service';
import {utilsService} from '@/services/utilities/utils-service';

export async function cloneEntry(state, router, rootStore, language, labels) {
    const projectRef = projectModel.getProjectRef();
    const formRef = state.formRef;
    //if entry is incomplete, bail out
    if (state.entry.synced === PARAMETERS.SYNCED_CODES.INCOMPLETE) {
        await notificationService.showAlert(labels.cannot_clone_incomplete_entry);
        return;
    }

    const confirmed = await notificationService.confirmSingle(
        STRINGS[language].status_codes.ec5_393
    );

    if (confirmed) {
        // Clone the entry
        const clonedEntry = utilsService.generateClonedEntry(state.entry);

        try {
            await databaseInsertService.cloneEntry(clonedEntry);
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
            await notificationService.showAlert(
                error,
                STRINGS[language].labels.error);
        }
    }
}
