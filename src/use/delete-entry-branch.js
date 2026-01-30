import {projectModel} from '@/models/project-model';
import {databaseDeleteService} from '@/services/database/database-delete-service';
import {notificationService} from '@/services/notification-service';
import {STRINGS} from '@/config/strings';
import {databaseSelectService} from '@/services/database/database-select-service';
import {deleteFileService} from '@/services/filesystem/delete-file-service';

export async function deleteEntryBranch(state, language, labels, goBack) {
    const confirmed = await notificationService.confirmSingle(
        STRINGS[language].status_codes.ec5_129,
        labels.delete_branch_entry + '?'
    );

    if (confirmed) {
        await notificationService.showProgressDialog(labels.wait);
        await databaseDeleteService.deleteBranchEntry(state.entryUuid);

        // Delete all the media related to this entry
        const mediaFiles = await databaseSelectService.selectProjectMedia({
            project_ref: projectModel.getProjectRef(),
            synced: null,
            entry_uuid: [state.entryUuid]
        });

        // If any media files
        const allMediaFiles = mediaFiles.audios
            .concat(mediaFiles.videos)
            .concat(mediaFiles.photos);

        if (allMediaFiles.length === 0) {
            // Go back
            notificationService.showToast(labels.entry_deleted);
            goBack();
            return false;
        }

        try {
            await deleteFileService.removeFiles(allMediaFiles);
            //remove all related rows from media table
            await databaseDeleteService.deleteEntryMedia(state.entryUuid);
            //navigate back
            notificationService.showToast(labels.entry_deleted);
            goBack();
        } catch (error) {
            console.log(error);
            await notificationService.showAlert(labels.unknown_error);
            notificationService.hideProgressDialog();
        }
    }
}
