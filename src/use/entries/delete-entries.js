
import { projectModel } from '@/models/project-model.js';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { menuController } from '@ionic/vue';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { notificationService } from '@/services/notification-service';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';
/**
 * Delete all entries and redirect to Entries page
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

    try {
        //clear the media folders for this project regardless of the media table
        await deleteFileService.removeProjectMediaDirectories(projectModel.getProjectRef(), false);
        await databaseDeleteService.deleteEntries(projectModel.getProjectRef());
        await _onDeleteSuccess();
    } catch (error) {
        console.log(error);
        notificationService.hideProgressDialog();
        await notificationService.showAlert(labels.unknown_error, labels.error);
    }

    async function _onDeleteSuccess () {
        const bookmarkStore = useBookmarkStore();
        const projectRef = projectModel.getProjectRef();
        entriesDownloadProgressService.clearProject(projectRef);
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
            await notificationService.showAlert(labels.bookmarks_loading_error);
            bookmarkStore.setBookmarks([]);
        }
        //show feedback to users
        notificationService.hideProgressDialog();
        notificationService.showToast(STRINGS[language].status_codes.ec5_122);
        //reset navigation
        rootStore.hierarchyNavigation = [];
        // Go back to Entries page
        menuController.close();
        router.replace({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
                refreshEntries: true,
                timestamp: Date.now()
            }
        });
    }
}
