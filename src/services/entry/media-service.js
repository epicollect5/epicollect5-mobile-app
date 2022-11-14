import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings.js';
import { databaseSelectService } from '@/services/database/database-select-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { utilsService } from '@/services/utilities/utils-service';
import { entryService } from '@/services/entry/entry-service';
import { moveFileService } from '@/services/filesystem/move-file-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';

export const mediaService = {
    saveMedia (entry, syncType) {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;

        return new Promise((resolve, reject) => {
            (async () => {
                //map media object to array (cached and store properties contains only the filename)
                //also empty answers (no media was saved) are filtered
                const mediaFiles = utilsService.mapMediaObjectToArray(entry.media);
                const queuedFiles = [...rootStore.queueFilesToDelete];
                let filename;

                if (rootStore.queueFilesToDelete.length > 0) {
                    //remove all queued files
                    try {
                        await deleteFileService.removeFiles(queuedFiles);
                    } catch (error) {
                        console.log(error);
                        reject(error);
                    }
                    try {
                        //remove files references from media table
                        const filenamesToDelete = rootStore.queueFilesToDelete.map((file) => {
                            return '"' + file.file_name + '"';
                        });
                        await databaseDeleteService.deleteMediaFiles(entry.entryUuid, filenamesToDelete);
                        //reset delete queue
                        rootStore.queueFilesToDelete = [];
                    } catch (error) {
                        console.log(error);
                        reject(error.message || labels.unknown_error);
                    }
                }
                //error callback
                function _onError (error) {
                    console.log(error);
                    reject(error);
                }

                if (mediaFiles.length > 0) {
                    //insert file references to db
                    databaseInsertService.insertMedia(entry, mediaFiles, syncType).then(function (response) {
                        //move files (recursively) from app cache folder to app private folder for permanent storage
                        function _moveFile (file) {

                            //do we have a new file to save?
                            if (file.cached !== '') {

                                //if we have a stored filename, overwrite that, otherwise create new file
                                filename = (file.stored === '') ? file.cached : file.stored;

                                moveFileService.moveToAppPrivateDir(
                                    rootStore.tempDir + file.cached,
                                    filename,
                                    file.type,
                                    projectModel.getProjectRef()
                                ).then(function () {
                                    //file moved ok, move next if any
                                    if (mediaFiles.length > 0) {
                                        _moveFile(mediaFiles.pop());
                                    }
                                    else {
                                        if (syncType === PARAMETERS.SYNCED_CODES.UNSYNCED) {
                                            databaseUpdateService.updateFileEntryIncomplete(entry.entryUuid).then(
                                                function () {
                                                    resolve();
                                                }, _onError);
                                        }
                                        else {
                                            resolve();
                                        }
                                    }
                                }, _onError);
                            }
                        }
                        //move file
                        _moveFile(mediaFiles.pop());
                    }, _onError);
                }
                else {
                    console.log('saving media with syncType= ', syncType);
                    //update any incomplete media file for this entry
                    //(set them to unsynced(0) when there is an actual save (syncType = 0))
                    if (syncType === PARAMETERS.SYNCED_CODES.UNSYNCED) {
                        databaseUpdateService.updateFileEntryIncomplete(entry.entryUuid).then(
                            function (response) {
                                resolve();
                            }, _onError);
                    }
                    else {
                        resolve();
                    }
                }
            })();
        });
    },

    //Get media stored for a single entry and return media object
    getEntryStoredMedia (uuid) {

        return new Promise((resolve, reject) => {
            const media = {};
            const projectRef = projectModel.getProjectRef();

            // Error callback
            function _onError (error) {
                console.log(error);
                reject(error);
            }

            databaseSelectService.selectEntryMedia(projectRef, uuid).then(function (response) {
                console.log(response);
                // Parse response and build media object
                response.forEach((value) => {
                    console.log(value);
                    // If we have a branch entry uuid, we will use that
                    // Otherwise, use the main entry uuid
                    console.log('branch entry uuid: ' + value.branch_entry_uuid);
                    console.log('entry uuid: ' + value.entry_uuid);
                    const entryUuid = (value.branch_entry_uuid ? value.branch_entry_uuid : value.entry_uuid);

                    media[entryUuid] = media[entryUuid] || {};
                    media[entryUuid][value.input_ref] = {};
                    media[entryUuid][value.input_ref].cached = '';
                    media[entryUuid][value.input_ref].stored = value.file_name;
                    media[entryUuid][value.input_ref].type = value.file_type;
                });
                resolve(media);
            }, _onError);
        });
    },

    getEntryStoredMediaPWA (uuid) {

        return new Promise((resolve, reject) => {
            const mediaTypes = [
                PARAMETERS.QUESTION_TYPES.PHOTO,
                PARAMETERS.QUESTION_TYPES.AUDIO,
                PARAMETERS.QUESTION_TYPES.VIDEO
            ];
            const media = {};
            const mediaInputs = Object.values(projectModel.getExtraInputs())
                .filter((input) => {
                    return mediaTypes.includes(input.data.type);
                });

            const answers = entryService.entry.answers;
            mediaInputs.forEach((mediaInput) => {
                const inputRef = mediaInput.data.ref;
                //if no answer, default to empty string (no media file)
                const answer = answers[inputRef]?.answer || '';
                media[uuid] = media[uuid] || {};
                media[uuid][mediaInput.data.ref] = {};
                media[uuid][mediaInput.data.ref].filenamePWA = {};
                media[uuid][mediaInput.data.ref].filenamePWA.cached = '';
                //get existing answer
                media[uuid][mediaInput.data.ref].filenamePWA.stored = answer;
            });

            resolve(media);
        });
    },

    getProjectStoredMedia (options) {
        return new Promise((resolve, reject) => {
            // Error callback
            function _onError (error) {
                console.log(error);
                reject(error);
            }
            //select only unsynced media files (synced flag 0)
            databaseSelectService.selectProjectMedia(options).then(function (response) {
                resolve(response);
            }, _onError);
        });
    }
};
