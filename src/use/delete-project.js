import { projectModel } from '@/models/project-model.js';

import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import * as services from '@/services';
import { menuController } from '@ionic/vue';

/**
 * Delete a project and redirect to projects page if success
 */
export async function deleteProject (router) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;



    //ask user confirmation
    const confirmed = await services.notificationService.confirmSingle(
        STRINGS[language].status_codes.ec5_113,
        STRINGS[language].labels.delete_project
    );

    if (!confirmed) {
        return false;
    }

    //show spinning loader
    await services.notificationService.showProgressDialog(
        STRINGS[language].labels.deleting_project
    );

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
            await services.databaseDeleteService.deleteProject(projectModel.getProjectRef());
            _onDeleteSuccess();
        } catch (error) {
            console.log(error);
            services.notificationService.hideProgressDialog();
            services.notificationService.showAlert(labels.unknown_error, labels.error);
        }
    } else {
        try {
            await services.databaseDeleteService.deleteProject(projectModel.getProjectRef());
            _onDeleteSuccess();
        } catch (error) {
            console.log(error);
            services.notificationService.hideProgressDialog();
            services.notificationService.showAlert(labels.unknown_error, labels.error);
        }
    }

    async function _onDeleteSuccess () {
        // Refresh bookmarks after deletion
        await services.bookmarksService.getBookmarks();
        // Destroy project model
        projectModel.destroy();
        //show feedback to user
        services.notificationService.hideProgressDialog();
        services.notificationService.showToast(STRINGS[language].status_codes.ec5_114);
        //hide right drawer
        menuController.close();
        // Go back to projects page
        router.replace({
            name: PARAMETERS.ROUTES.PROJECTS,
            params: { refresh: true }
        });
    }
}