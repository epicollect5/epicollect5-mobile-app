
import { projectModel } from '@/models/project-model.js';

import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import * as services from '@/services';
import { menuController } from '@ionic/vue';
/**
 * Delete all entries and redirect to entries page
 */
export async function deleteEntries (router) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    //ask user confirmation
    const confirmed = await services.notificationService.confirmSingle(
        STRINGS[language].status_codes.ec5_121,
        STRINGS[language].labels.delete_all_entries
    );

    if (!confirmed) {
        return false;
    }

    await services.notificationService.showProgressDialog(labels.deleting_entries);

    //get project media files
    const projectMedia = await services.databaseSelectService.selectProjectMedia({
        project_ref: projectModel.getProjectRef(),
        synced: null,
        entry_uuid: null
    });

    //if any media files
    const files = projectMedia.audios.concat(projectMedia.videos).concat(projectMedia.photos);
    console.log(files);

    if (files.length > 0) {
        try {
            await services.deleteFileService.removeFiles(files);
            await services.databaseDeleteService.deleteEntries(projectModel.getProjectRef());
            _onDeleteSuccess();

        } catch (error) {
            console.log(error);
            services.notificationService.hideProgressDialog();
            services.notificationService.showAlert(labels.unknown_error, labels.error);
        }
    }
    else {
        try {
            await services.databaseDeleteService.deleteEntries(projectModel.getProjectRef());
            _onDeleteSuccess();
        }
        catch (error) {
            console.log(error);
            services.notificationService.hideProgressDialog();
            services.notificationService.showAlert(labels.unknown_error, labels.error);
        }
    }

    async function _onDeleteSuccess () {
        // Refresh bookmarks after deletion
        await services.bookmarksService.getBookmarks();
        //show feedback to users
        services.notificationService.hideProgressDialog();
        services.notificationService.showToast(STRINGS[language].status_codes.ec5_122);
        //reset navigation
        rootStore.hierarchyNavigation = [];
        // Go back to entries page
        menuController.close();
        router.replace({
            name: PARAMETERS.ROUTES.ENTRIES,
            params: { refreshEntries: true }
        });
    }
}