
import { projectModel } from '@/models/project-model.js';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { menuController } from '@ionic/vue';
import { databaseSelectService } from '@/services/database/database-select-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { notificationService } from '@/services/notification-service';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
/**
 * Delete all entries and redirect to entries page
 */
export async function deleteEntries (router) {

    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    //ask user confirmation
    const confirmed = await notificationService.confirmSingle(
        STRINGS[language].status_codes.ec5_121,
        STRINGS[language].labels.delete_all_entries
    );

    if (!confirmed) {
        return false;
    }

    await notificationService.showProgressDialog(labels.deleting_entries);

    //get project media files
    const projectMedia = await databaseSelectService.selectProjectMedia({
        project_ref: projectModel.getProjectRef(),
        synced: null,
        entry_uuid: null
    });

    //if any media files
    const files = projectMedia.audios.concat(projectMedia.videos).concat(projectMedia.photos);
    console.log(files);

    if (files.length > 0) {
        try {
            await deleteFileService.removeFiles(files);
            await databaseDeleteService.deleteEntries(projectModel.getProjectRef());
            _onDeleteSuccess();

        } catch (error) {
            console.log(error);
            notificationService.hideProgressDialog();
            notificationService.showAlert(labels.unknown_error, labels.error);
        }
    }
    else {
        try {
            await databaseDeleteService.deleteEntries(projectModel.getProjectRef());
            _onDeleteSuccess();
        }
        catch (error) {
            console.log(error);
            notificationService.hideProgressDialog();
            notificationService.showAlert(labels.unknown_error, labels.error);
        }
    }

    async function _onDeleteSuccess () {
        const bookmarkStore = useBookmarkStore();
        const projectRef = projectModel.getProjectRef();
        // Refresh bookmarks after deletion
        try {
            await bookmarksService.deleteBookmarks(projectRef);
        }
        catch (error) {
            console.log(error);
        }

        try {
            const bookmarks = await bookmarksService.getBookmarks();
            bookmarkStore.setBookmarks(bookmarks);
        }
        catch (error) {
            notificationService.showAlert(labels.bookmarks_loading_error);
            bookmarkStore.setBookmarks([]);
        }
        //show feedback to users
        notificationService.hideProgressDialog();
        notificationService.showToast(STRINGS[language].status_codes.ec5_122);
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