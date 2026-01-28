import {projectModel} from '@/models/project-model';
import {databaseDeleteService} from '@/services/database/database-delete-service';
import {bookmarksService} from '@/services/utilities/bookmarks-service';
import {notificationService} from '@/services/notification-service';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {databaseSelectService} from '@/services/database/database-select-service';
import {deleteFileService} from '@/services/filesystem/delete-file-service';

export async function deleteEntry(state, router, bookmarkStore, rootStore, language, labels) {
    const projectRef = projectModel.getProjectRef();
    const formRef = state.formRef;
    let allEntries = [];
    const uuids = [];
    const files = [];

    //todo: should probably catch errors...
    async function _deleteAllEntries(uuids) {
        //map all the uuids to promises
        await Promise.all(
            uuids.map((uuid) => {
                return databaseDeleteService.deleteEntry(uuid);
            })
        );

        //delete any bookmarks related to current entry uuid
        try {
            await bookmarksService.deleteBookmarksForEntry(state.entryUuid);
        } catch (error) {
            console.log(error);
            await notificationService.showAlert(labels.bookmarks_loading_error);
        }

        // Refresh bookmarks after deletion
        try {
            const bookmarks = await bookmarksService.getBookmarks();
            bookmarkStore.setBookmarks(bookmarks);
        } catch (error) {
            await notificationService.showAlert(labels.bookmarks_loading_error);
            bookmarkStore.setBookmarks([]);
        }

        //back to entries list with refresh
        if (rootStore.nextRoute) {
            const route = rootStore.nextRoute;
            const refreshEntries = route === PARAMETERS.ROUTES.ENTRIES;
            const refreshEntriesErrors = route === PARAMETERS.ROUTES.ENTRIES_ERRORS;

            //there is a route saved, go there
            //(should be either the EntriesError or Entries page)
            router.replace({
                name: rootStore.nextRoute,
                query: {
                    refreshEntries,
                    refreshEntriesErrors,
                    timestamp: Date.now()
                }
            });
            //reset route
            rootStore.nextRoute = null;
        } else {
            rootStore.routeParams = {
                projectRef: projectModel.getProjectRef(),
                formRef: state.formRef
            };
            router.replace({
                name: PARAMETERS.ROUTES.ENTRIES,
                query: {
                    refreshEntries: true,
                    timestamp: Date.now()
                }
            });
        }
        notificationService.showToast(labels.entry_deleted);
    }

    const confirmed = await notificationService.confirmSingle(
        STRINGS[language].status_codes.ec5_129
    );

    if (confirmed) {
        // Get an array of all the child entries related to this entry (if any)
        databaseSelectService
            .getHierarchyEntries(state.entryUuid)
            .then(function (relatedEntries) {
                //get all media files names for this entry, child entries and branch entries
                allEntries = relatedEntries.entries
                    .concat(relatedEntries.branchEntries)
                    .concat([state.entryUuid]);

                // Now grab the media entries if any
                Promise.all(
                    allEntries.map(function (uuid) {
                        return databaseSelectService.selectEntryMedia(projectRef, uuid);
                    })
                ).then(function (mediaRows) {
                    //mediaRows is an array of arrays, flat it to a single array of uuids
                    //also a flat array of file objects for deletion
                    mediaRows.forEach((rows) => {
                        rows.forEach((entry) => {
                            uuids.push(entry.entry_uuid);
                            files.push({
                                file_name: entry.file_name,
                                file_path: entry.file_path,
                                project_ref: projectRef
                            });
                        });
                    });

                    //if any, delete all media files for this entry, child entries and branch entries
                    if (files.length > 0) {
                        deleteFileService.removeFiles(files).then(function () {
                            //then delete media entries in media table
                            Promise.all(
                                uuids.map(function (uuid) {
                                    return databaseDeleteService.deleteEntryMedia(uuid);
                                })
                            ).then(function () {
                                // Now delete all the entries
                                _deleteAllEntries(allEntries);
                            });
                        });
                    } else {
                        // No files, just delete all the entries
                        _deleteAllEntries(allEntries);
                    }
                });
            });
    }
}
