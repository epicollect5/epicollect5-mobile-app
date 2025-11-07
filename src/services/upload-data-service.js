import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import { databaseSelectService } from '@/services/database/database-select-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { notificationService } from '@/services/notification-service';
import { webService } from '@/services/web-service';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';

export const uploadDataService = {

    showErrors: false,
    // Default error object
    errorPayload: {
        errors: [{
            code: 'ec5_103',
            source: '',
            title: ''
        }]
    },

    // need to handle server errors/unexpected errors etc.
    // check file uploads, cordova errors:
    // 'Uncaught SyntaxError: Unexpected token o'
    // 'Uncaught SyntaxError: Unexpected token u'

    /**
     * Function to upload all entries one at a time
     * Will first upload parent>branches>child>branches>child>branches....etc.
     * Working through the hierarchy
     *
     * When we reach the bottom, we then start syncing each entry in the database until we reach
     * the top, where we will move on to the next top level parent entry and repeat the process
     *
     * @param total
     */
    execute(total) {

        const self = this;

        return new Promise(function (resolve, reject) {
            const rootStore = useRootStore();
            const language = rootStore.language;
            let currentEntryIndex = 0;
            let entry;
            const entries = [];
            const projectRef = projectModel.getProjectRef();
            // Get top level parent form ref
            const topLevelFormRef = projectModel.getFirstFormRef();
            const slug = projectModel.getSlug();
            let parentUuid;
            let ownerEntryUuid;


            self.showErrors = false;

            // Default error object in locale language
            self.errorPayload = {
                errors: [{
                    code: 'ec5_103',
                    source: '',
                    title: STRINGS[language].status_codes.ec5_103
                }]
            };

            /**
             * Function for uploading entries (parent and child)
             *
             * @private
             */
            function _uploadEntry(formRef) {

                parentUuid = null;

                // No more children to upload for the current top level parent
                if (entries.length === 0 && formRef === null) {
                    console.log('uploading next top level parent entry');
                    // Go to next top level entry upload
                    window.setTimeout(function () {
                        _uploadEntry(topLevelFormRef);
                    }, PARAMETERS.DELAY_LONG);
                } else {
                    // Get unsynced entries, one at a time, based on supplied parent entry uuid
                    // If a formRef is supplied, we are attempting to retrieve a parent
                    if (entries.length > 0) {
                        parentUuid = entries[entries.length - 1];
                    }
                    // Select one entry that is either unsynced, or has unsynced children
                    databaseSelectService.selectOneEntry(projectRef, formRef, parentUuid, [PARAMETERS.SYNCED_CODES.UNSYNCED, PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES], null).then(
                        function (res) {
                            if (res.rows.length > 0) {
                                console.log('synced code: ' + res.rows.item(0).synced);
                                // Check if the user can edit
                                // If we have a synced value HAS_UNSYNCED_CHILD_ENTRIES, then we will also ignore
                                if (res.rows.item(0).can_edit === 0 || res.rows.item(0).synced === PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES) {
                                    _updateProgress();
                                    // Can't edit, so just insert branches
                                    console.log('cant edit or only uploading child entries, synced and moved on: ' + res.rows.item(0).entry_uuid);
                                    // Add entry uuid to entries array, to retrieve its children later
                                    entries.push(res.rows.item(0).entry_uuid);
                                    // Upload branches for this entry
                                    window.setTimeout(function () {
                                        _uploadBranch();
                                    }, PARAMETERS.DELAY_LONG);
                                } else {
                                    entry = JSONTransformerService.makeJsonEntry(PARAMETERS.ENTRY, res.rows.item(0));
                                    webService.uploadEntry(slug, entry).then(
                                        function () {
                                            _updateProgress();
                                            console.log('uploaded entry: ' + res.rows.item(0).entry_uuid);
                                            // Add entry uuid to entries array, to retrieve its children later
                                            entries.push(res.rows.item(0).entry_uuid);
                                            // Upload branches for this entry
                                            window.setTimeout(function () {
                                                _uploadBranch();
                                            }, PARAMETERS.DELAY_LONG);

                                        }, async function (response) {

                                            console.log('entry upload failed', entry);
                                            //grab the unsynced branch entries count for this entry and
                                            //upload the progress with that total since we are
                                            //skipping to the next hierarchy entry
                                            const ownerEntryUuid = entry.entry.entry_uuid;
                                            const entryBranchesCount = await databaseSelectService.countUnsyncedBranchEntries(projectRef, ownerEntryUuid);

                                            //add branches to upload counter (if any)
                                            if (entryBranchesCount.rows.item(0).count > 0) {
                                                _updateProgress(entryBranchesCount.rows.item(0).count);
                                            }

                                            if (response === undefined) {
                                                //reject (nothing passed,server default error)
                                                reject();
                                            }
                                            try {
                                                self.handleUploadError(PARAMETERS.ENTRY, response, res.rows.item(0).entry_uuid).then(
                                                    function () {
                                                        _updateProgress();
                                                        // Continue - try to upload the next child
                                                        window.setTimeout(function () {
                                                            _uploadEntry(null);
                                                        }, PARAMETERS.DELAY_LONG);
                                                    }, function (error) {
                                                        if (self.showErrors) {
                                                            // Show stopping error, resolve with entries errors
                                                            resolve(true);
                                                        } else {
                                                            // Show stopping error, reject, show no entries errors
                                                            reject(error);
                                                        }
                                                    });
                                            }
                                            catch (error) {
                                                //reject (nothing passed,server default error)
                                                reject();
                                            }
                                        });
                                }
                            }
                            else if (formRef && res.rows.length === 0) {
                                console.log('Finished uploading');
                                // If we have a form ref and no entries left
                                // Finished!
                                resolve(self.showErrors);

                            } else {
                                // If we have entries, set the parentUuid as the most recent uuid in the entries array
                                // As this is the uuid we're currently processing
                                if (entries.length > 0) {
                                    parentUuid = entries[entries.length - 1];
                                }
                                // Only sync this entry when fully uploaded (all its branches and children are uploaded)
                                databaseUpdateService.updateSynced(PARAMETERS.ENTRY, parentUuid, PARAMETERS.SYNCED_CODES.SYNCED).then(
                                    function () {
                                        console.log('Syncing');
                                        // No children left to upload for this entry
                                        // Go back up the chain
                                        entries.pop();
                                        window.setTimeout(function () {
                                            _uploadEntry(null);
                                        }, PARAMETERS.DELAY_LONG);
                                    });
                            }
                        }
                    );
                }
            }

            /**
             * Function for uploading branches
             *
             * @private
             */
            function _uploadBranch() {

                ownerEntryUuid = null;

                // If we have entries, set the ownerEntryUuid as the most recent uuid in the entries array
                // As this is the uuid we're currently processing
                if (entries.length > 0) {
                    ownerEntryUuid = entries[entries.length - 1];
                }

                // Select one unsynced branch entry
                databaseSelectService.selectOneBranchEntry(projectRef, ownerEntryUuid, PARAMETERS.SYNCED_CODES.UNSYNCED).then(
                    function (res) {

                        // If we have a branch, upload it
                        if (res.rows.length > 0) {

                            // Can edit, so go ahead and upload entry
                            if (res.rows.item(0).can_edit === 1) {

                                entry = JSONTransformerService.makeJsonEntry(PARAMETERS.BRANCH_ENTRY, res.rows.item(0));

                                webService.uploadEntry(slug, entry).then(
                                    function () {
                                        // Sync branch entry
                                        databaseUpdateService.updateSynced(PARAMETERS.BRANCH_ENTRY, res.rows.item(0).entry_uuid, PARAMETERS.SYNCED_CODES.SYNCED).then(
                                            function () {
                                                console.log('Syncing branch');
                                                _updateProgress();
                                                console.log('uploaded branch entry: ' + res.rows.item(0).entry_uuid);
                                                // Upload the next branch
                                                window.setTimeout(function () {
                                                    _uploadBranch();
                                                }, PARAMETERS.DELAY_LONG);
                                            });
                                    }, function (response) {

                                        //catch drop connection error here
                                        self.handleUploadError(PARAMETERS.BRANCH_ENTRY, response, res.rows.item(0).entry_uuid).then(
                                            function () {
                                                _updateProgress();
                                                // Continue - upload the next branch
                                                window.setTimeout(function () {
                                                    _uploadBranch();
                                                }, PARAMETERS.DELAY_LONG);
                                            }, function (error) {
                                                if (self.showErrors) {
                                                    // Show stopping error, resolve with errors
                                                    resolve(true);
                                                } else {
                                                    // Show stopping error, reject, show no errors
                                                    reject(error);
                                                }
                                            });
                                    });
                            } else {
                                _updateProgress();
                                // Can't edit, so move onto next branch
                                window.setTimeout(function () {
                                    _uploadBranch();
                                }, PARAMETERS.DELAY_LONG);
                            }
                        } else {
                            // If no more branches to upload, go back to previous entry and attempt to upload its next child
                            window.setTimeout(function () {
                                _uploadEntry(null);
                            }, PARAMETERS.DELAY_LONG);
                        }
                    });
            }
            /**
             * Update the progress counter
             */
            function _updateProgress(count) {
                count ? currentEntryIndex += count : currentEntryIndex++;
                notificationService.setProgress({ total, done: currentEntryIndex });
            }
            // Start upload from parent form
            _uploadEntry(topLevelFormRef);
        });
    },
    /**
    * Handle an upload error
    * May be show stopping, or may allow the rest of the upload to continue
    */
    handleUploadError(type, errorResponse, entryUuid) {

        const self = this;

        // imp:List of error codes to be handled by the web error service, which will stop the upload process
        // imp: PARAMETERS.UPLOAD_STOPPING_ERROR_CODES;
        self.showErrors = true;

        return new Promise(function (resolve, reject) {

            if (!errorResponse.data) {
                //response.data is null or undefined
                reject();
                return false;
            }

            self.errorPayload = errorResponse.data;

            // Check if we have an authentication error
            if (self.errorPayload.errors && PARAMETERS.UPLOAD_STOPPING_ERROR_CODES.indexOf(self.errorPayload.errors[0].code) >= 0) {
                console.log('Permission error code hit -> ', self.errorPayload.errors[0].code);
                // We don't want to alarm the user there is an error with the entry (because the error is related to permissions)
                // Don't show error text
                self.showErrors = false;
                // Send back the error code
                reject({ data: errorResponse.data });
                return false;
            }
            // Update synced_error field then allow upload to continue
            databaseUpdateService
                .updateSynced(type, entryUuid, PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, self.errorPayload)
                .then(() => {
                    console.log('Syncing error');
                    resolve();
                }, (error) => {
                    console.log(error);
                    reject();
                });
        });
    }
};
