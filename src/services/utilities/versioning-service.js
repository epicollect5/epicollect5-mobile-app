
import { useRootStore } from '@/stores/root-store';
import { databaseSelectService } from '@/services/database/database-select-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { downloadFileService } from '@/services/download-file-service';
import { utilsService } from '@/services/utilities/utils-service';
import { webService } from '@/services/web-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { answerService } from '@/services/entry/answer-service';


export const versioningService = {

    previousProjectStructure: {},
    changeMade: false,

    // Check project version is current
    async checkProjectVersion() {
        try {
            // 1. Check for internet connection
            const hasInternet = await utilsService.hasInternetConnection();

            if (hasInternet) {
                // 2. Fetch remote version
                const response = await webService.getProjectVersion(projectModel.getSlug());
                const remoteVersion = response.data.data.attributes.structure_last_updated;
                const localVersion = projectModel.getLastUpdated();

                // 3. Compare versions
                // Resolve true if versions match, false if they don't
                return remoteVersion === localVersion;
            }

            // If no internet, we assume it's "ok" to proceed
            return true;

        } catch (error) {
            console.error('Error checking project version:', error);
            // Project has been trashed/deleted on the server: surface the error
            // so uploads/downloads can be stopped instead of failing silently
            if (error?.data?.errors?.[0]?.code === 'ec5_11') {
                throw error;
            }
            // On any other error, we resolve true to prevent blocking the user
            return true;
        }
    },

    //Update the project and all entries
    async updateProject () {

        const rootStore = useRootStore();
        const language = rootStore.language;

        //no active project loaded: nothing to update, reject cleanly
        //instead of crashing on an empty project model (getSlug() would throw)
        if (!projectModel.hasInitialised()) {
            throw {
                data: {
                    errors: [{
                        code: 'ec5_116',
                        source: '',
                        title: STRINGS[language].status_codes.ec5_116
                    }]
                }
            };
        }

        // Fetch the updated project
        const response = await webService.getProject(projectModel.getSlug());

        // Check if we don't have project
        if (!response.data) {
            throw {
                data: {
                    errors: [{
                        code: 'ec5_116',
                        source: '',
                        title: STRINGS[language].status_codes.ec5_116
                    }]
                }
            };
        }

        let projectExtra;
        let projectMapping;
        let lastUpdated;

        try {
            console.log(response.data.meta.project_extra);
            projectExtra = JSON.stringify(response.data.meta.project_extra);
            projectMapping = JSON.stringify(response.data.meta.project_mapping);
            lastUpdated = response.data.meta.project_stats.structure_last_updated;
        } catch (e) {
            console.log(e);
            throw e;
        }

        // Store the previous project structure for later comparison
        this.previousProjectStructure = projectModel.getProjectExtra();
        // Save the current timestamp so it can be rolled back if
        // stale-entry cleanup fails: the database and in-memory
        // model will already carry the new value, but we need
        // checkProjectVersion() to detect a mismatch on the next
        // attempt so the cleanup is retried.
        const previousLastUpdated = projectModel.getLastUpdated();
        console.log('updating project');

        // Update the project
        await databaseUpdateService.updateProject(
            projectModel.getProjectRef(),
            projectExtra,
            projectMapping,
            lastUpdated
        );

        // Update the in-memory model only after the new structure has been
        // persisted: if the persistence fails, model and database stay
        // consistent with the previous structure and the update can be retried
        console.log('updated project');

        // Load updated project extra structure into project model
        projectModel.loadExtraStructure(response.data.meta.project_extra);
        // Keep the in-memory mapping in sync with the updated structure,
        // otherwise exports use a stale mapping and crash on new inputs
        projectModel.loadMappings(response.data.meta.project_mapping);
        projectModel.setLastUpdated(lastUpdated);

        console.log('updating entries');

        // Update entries for each form
        const forms = projectModel.getFormsInOrder();
        for (const form of forms) {
            try {
                await this.selectAndUpdateEntries(form.formRef);
                console.log('successfully updated entries for form: ' + form.formRef);
            } catch (_) {
                console.log('failed updated entries for form: ' + form.formRef);
            }
        }

        // Remove the entries (and their media) of any forms or
        // branches that have been removed from the project structure,
        // comparing the stored entries against the current structure.
        // A failure here must block the update: the stale entries would
        // otherwise tamper with syncing, so the user is informed and
        // can retry (or export and delete the entries) and the cleanup
        // is retried on the next update or "unsync all entries"
        try {
            await this.removeStaleEntries();
        } catch (error) {
            // Failed to remove the entries of removed forms/branches:
            // roll back last_updated so the next version check
            // detects a mismatch and retries the cleanup
            projectModel.setLastUpdated(previousLastUpdated);
            try {
                await databaseUpdateService.updateProject(
                    projectModel.getProjectRef(),
                    projectExtra,
                    projectMapping,
                    previousLastUpdated
                );
            } catch (rollbackError) {
                // The rollback write must not mask the cleanup error:
                // callers rely on isStaleCleanupError to inform the user,
                // and the failed rollback is logged for diagnostics
                console.error('Failed to roll back last_updated after stale entry cleanup failure', rollbackError);
            }
            throw error;
        }

        // Attempt to update the project logo (non-fatal)
        try {
            await downloadFileService.downloadProjectLogo(projectModel.getSlug(), projectModel.getProjectRef());
            console.log('downloaded logo');
        } catch (_) {
            console.log('didnt download logo');
        }

        const result = this.changeMade;
        // Reset changeMade back to false
        this.changeMade = false;
        return result;
    },

    /**
     * Remove the entries (and their media) of any forms that have been removed from
     * the project structure, as they can never be uploaded or edited again.
     * Rejects on the first failure, so callers can block the operation and let the
     * user retry, instead of silently keeping stale entries that tamper with syncing.
     */
    async _removeStaleFormsEntries (projectRef, formRefs) {

        for (const formRef of formRefs) {
            const [entriesResult, branchEntriesResult] = await Promise.all([
                databaseSelectService.selectEntries(projectRef, formRef),
                databaseSelectService.selectBranchEntries(projectRef, formRef)
            ]);

            // Collect all the entry uuids (entries and branch entries) for this form
            const entryUuids = [];
            for (let i = 0; i < entriesResult.rows.length; i++) {
                entryUuids.push(entriesResult.rows.item(i).entry_uuid);
            }
            for (let i = 0; i < branchEntriesResult.rows.length; i++) {
                entryUuids.push(branchEntriesResult.rows.item(i).entry_uuid);
            }

            // Delete all the media related to these entries
            // (media rows must be fetched before deleting the entries)
            // Note: selectProjectMedia only works with a single entry_uuid
            // (multiple uuids get joined into one IN clause value)
            for (const entryUuid of entryUuids) {
                const mediaFiles = await databaseSelectService.selectProjectMedia({
                    project_ref: projectRef,
                    synced: null,
                    entry_uuid: [entryUuid]
                });

                const allMediaFiles = mediaFiles.photos
                    .concat(mediaFiles.audios)
                    .concat(mediaFiles.videos);

                if (allMediaFiles.length > 0) {
                    await deleteFileService.removeFiles(allMediaFiles);
                }
            }

            // Now delete all the rows related to this form
            await databaseDeleteService.deleteFormEntries(projectRef, [formRef]);
        }
    },

    /**
     * Find the form refs that are stored locally but no longer exist in the
     * current project structure, as they can never be uploaded or edited again.
     */
    async _getStaleFormRefs (projectRef) {

        const staleFormRefs = [];
        const storedFormRefs = await databaseSelectService.selectDistinctFormRefs(projectRef);
        const currentForms = projectModel.getProjectExtra().forms;

        for (const formRef of storedFormRefs) {
            const currentForm = currentForms[formRef];
            // Form doesn't exist in the current structure anymore
            if (!currentForm || Object.keys(currentForm).length === 0) {
                console.log('form ' + formRef + ' to be removed');
                staleFormRefs.push(formRef);
            }
        }

        return staleFormRefs;
    },

    /**
     * Find the branches that are stored locally but no longer exist in the
     * current project structure, as they can never be uploaded or edited again.
     */
    async _getStaleBranchRefs (projectRef) {

        const staleBranchRefs = [];
        const storedBranchRefs = await databaseSelectService.selectDistinctBranchRefsIncludingTemp(projectRef);
        const currentForms = projectModel.getProjectExtra().forms;

        for (const storedBranch of storedBranchRefs) {
            const currentForm = currentForms[storedBranch.formRef];
            // Skip forms that have been removed entirely (handled by deleteFormEntries)
            if (!currentForm || Object.keys(currentForm).length === 0) {
                continue;
            }
            const currentBranches = currentForm.branch || {};
            // Branch doesn't exist in the current structure anymore
            if (!currentBranches[storedBranch.branchRef]) {
                console.log('branch ' + storedBranch.branchRef + ' to be removed');
                staleBranchRefs.push(storedBranch);
            }
        }

        return staleBranchRefs;
    },

    /**
     * Remove the entries (and their media) of any forms or branches that have been
     * removed from the project structure, by comparing the locally stored entries
     * against the current project structure.
     * Rejects on the first failure: callers must block the operation (e.g. the
     * project update or "unsync all entries") so the user is informed that stale
     * entries are still on the device, and the cleanup can be retried.
     */
    async removeStaleEntries () {

        try {
            const projectRef = projectModel.getProjectRef();

            // Remove the entries (and their media) of the removed forms
            const staleFormRefs = await this._getStaleFormRefs(projectRef);
            await this._removeStaleFormsEntries(projectRef, staleFormRefs);

            // Remove the entries of any branches that have been removed from the project
            const staleBranchRefs = await this._getStaleBranchRefs(projectRef);
            for (const staleBranch of staleBranchRefs) {
                await this._removeRemovedBranchEntries(projectRef, staleBranch.formRef, staleBranch.branchRef);
            }
        } catch (error) {
            console.error('Failed to remove entries of forms/branches removed from the project', error);
            error.isStaleCleanupError = true;
            throw error;
        }
    },

    async _removeRemovedBranchEntries (projectRef, formRef, branchRef) {

        const response = await databaseSelectService.selectBranchEntries(projectRef, formRef, branchRef);

        for (let i = 0; i < response.rows.length; i++) {
            const entryUuid = response.rows.item(i).entry_uuid;

            // Delete all the media related to this branch entry
            // (media rows must be fetched before deleting the branch entry)
            const mediaFiles = await databaseSelectService.selectProjectMedia({
                project_ref: projectRef,
                synced: null,
                entry_uuid: [entryUuid]
            });

            const allMediaFiles = mediaFiles.photos
                .concat(mediaFiles.audios)
                .concat(mediaFiles.videos);

            if (allMediaFiles.length > 0) {
                await deleteFileService.removeFiles(allMediaFiles);
            }

            await databaseDeleteService.deleteEntryMedia(entryUuid);
            await databaseDeleteService.deleteBranchEntry(entryUuid);
        }
    },

    selectAndUpdateEntries (formRef) {

        const self = this;
        const form = projectModel.getExtraForm(formRef);
        const groupInputs = form.group;
        const branchInputs = self.getBranchInputs(form);
        let inputs;
        let inputRefs;

        return new Promise((resolve, reject) => {

            //Select the entries to update
            function _selectEntries () {

                databaseSelectService.selectEntries(projectModel.getProjectRef(), formRef).then(
                    function (response) {

                        if (response.rows.length > 0) {

                            // Combine the inputs with the group inputs for this form
                            inputs = form.inputs;
                            inputRefs = self.getInputRefs(inputs, groupInputs);

                            // Update these form entries then move on to either its branches OR the next form
                            self.updateEntries(PARAMETERS.ENTRIES_TABLE, response, inputRefs).then(
                                function () {
                                    if (branchInputs.length > 0) {
                                        // Now get the branch entries for this form and update, if applicable
                                        // Starting from the first one
                                        selectBranchEntries(0);
                                    } else {
                                        // Else move on to next form
                                        resolve();
                                    }
                                },
                                function () {
                                    reject();
                                });
                        } else {
                            resolve();
                        }
                    },
                    function () {
                        reject();
                    });
            }

            /**
             * Select the branch entries to update
             *
             * @param branchIndex
             */
            function selectBranchEntries (branchIndex) {

                console.log('branch: ' + branchIndex);
                const currentBranch = branchInputs[branchIndex];
                const currentBranchRef = currentBranch.ref;

                // Select the branch entries for this owner_input_ref (branch ref)
                databaseSelectService.selectBranchEntries(projectModel.getProjectRef(), formRef, currentBranchRef).then(
                    function (response) {

                        if (response.rows.length > 0) {

                            // Combine the branch inputs with the group inputs for the branch
                            inputs = currentBranch.inputs;
                            inputRefs = self.getInputRefs(inputs, groupInputs);

                            // Update these entries then move on to next form
                            self.updateEntries(PARAMETERS.BRANCH_ENTRIES_TABLE, response, inputRefs).then(
                                function () {

                                    branchIndex += 1;
                                    if (branchIndex < branchInputs.length) {
                                        selectBranchEntries(branchIndex);
                                    } else {
                                        // Resolve
                                        resolve();
                                    }
                                },
                                function () {
                                    reject();
                                });
                        } else {
                            resolve();
                        }
                    },
                    function () {
                        reject();
                    });
            }
            // Start selecting entries to update
            // Begin with top level entries
            // Then move on to branches
            _selectEntries();
        });
    },

    updateEntries (table, response, inputRefs) {

        let entryId;
        let entryAnswers;
        const i = 0;
        const self = this;
        let changeDetected;

        return new Promise(function (resolve, reject) {

            function _updateNext (index) {

                // If we have no more entries, resolve
                if (index === response.rows.length) {
                    resolve();
                } else {

                    const entry = response.rows.item(index);

                    try {
                        entryId = entry.id;
                        entryAnswers = JSON.parse(entry.answers);
                    } catch (e) {
                        reject();
                    }

                    // Loop and compare the input refs to the answer input refs
                    // If a change was detected, we will update the db
                    changeDetected = self.updateEntry(entryAnswers, inputRefs);

                    // If no change detected, resolve and return
                    if (!changeDetected) {
                        console.log('no change, resolving');
                        // No need to continue, there are no new inputs
                        resolve();
                        return;
                    }

                    // Set global change made param
                    self.changeMade = changeDetected;

                    console.log('change');
                    try {
                        entryAnswers = JSON.stringify(entryAnswers);
                    } catch (e) {
                        console.log('failed');
                        reject();
                    }
                    databaseUpdateService.updateEntryAnswers(table, entryId, entryAnswers).then(
                        function () {
                            index++;
                            _updateNext(index);
                        },
                        function () {
                            index++;
                            _updateNext(index);
                        }
                    );
                }
            }
            // Start updating entries
            _updateNext(i);
        });
    },

    /**
     * Loop an entry's answers and fill in any missing input refs/answer objects
     * comparing against the previous project structure
     */
    updateEntry (entryAnswers, inputRefs) {

        let ref;
        let changeDetected = false;
        let inputDetails;


        for (ref in inputRefs) {
            if (Object.prototype.hasOwnProperty.call(inputRefs, ref)) {
                // If the input ref doesn't exist in the previous entry structure, add an answer object
                // Based on the passed input refs

                if (!Object.prototype.hasOwnProperty.call(this.previousProjectStructure.inputs, inputRefs[ref])) {
                    inputDetails = projectModel.getInput(inputRefs[ref]);
                    entryAnswers[inputRefs[ref]] = answerService.createDefaultAnswer(inputDetails);

                    // A change has been made
                    changeDetected = true;
                }
            }
        }
        return changeDetected;
    },

    /**
     * Function to combine the top level and group inputs
     * into a flat array of input refs
     */
    getInputRefs (inputs, groupInputs) {

        const inputRefs = [];
        let ref;
        let groupRef;
        let inputRef;

        // Create flat array of all inputs for this form, top level and group
        for (ref in inputs) {
            if (Object.prototype.hasOwnProperty.call(inputs, ref)) {
                for (inputRef in groupInputs) {
                    // If the group belongs to the main form
                    if (inputs[ref] === inputRef) {
                        if (Object.prototype.hasOwnProperty.call(groupInputs, inputRef)) {
                            // Loop round the nested group input refs
                            for (groupRef in groupInputs[inputRef]) {
                                if (Object.prototype.hasOwnProperty.call(groupInputs[inputRef], groupRef)) {
                                    // Add group input ref
                                    inputRefs.push(groupInputs[inputRef][groupRef]);
                                }
                            }
                        }
                    }
                }
                // Add top level input ref
                inputRefs.push(inputs[ref]);
            }
        }
        return inputRefs;
    },

    /**
     * Organise the branch inputs into a flat array
     */
    getBranchInputs (form) {

        const inputRefs = [];
        const branchInputs = form.branch;
        let ref;
        let obj;

        for (ref in branchInputs) {
            if (Object.prototype.hasOwnProperty.call(branchInputs, ref)) {
                obj = {
                    ref: ref,
                    inputs: branchInputs[ref]
                };
                inputRefs.push(obj);
            }
        }
        return inputRefs;
    }
};
