
import { useRootStore } from '@/stores/root-store';
import { databaseSelectService } from '@/services/database/database-select-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { downloadFileService } from '@/services/download-file-service';
import { utilsService } from '@/services/utilities/utils-service';
import { webService } from '@/services/web-service';
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
            // On error, we resolve true to prevent blocking the user
            return true;
        }
    },

    //Update the project and all entries
    updateProject () {

        let projectExtra = '';
        let projectMapping = '';
        let lastUpdated;
        const self = this;
        let previousFormRef;
        const formsToBeRemoved = [];

        const rootStore = useRootStore();
        const language = rootStore.language;

        return new Promise((resolve, reject) => {

            // Fetch the updated project
            webService.getProject(projectModel.getSlug()).then(
                function (response) {

                    // Check if we don't have project
                    if (!response.data) {
                        // Error
                        reject({
                            data: {
                                errors: [{
                                    code: 'ec5_116',
                                    source: '',
                                    title: STRINGS[language].status_codes.ec5_116
                                }]
                            }
                        });
                        return;
                    }

                    try {
                        console.log(response.data.meta.project_extra);
                        projectExtra = JSON.stringify(response.data.meta.project_extra);
                        projectMapping = JSON.stringify(response.data.meta.project_mapping);
                        lastUpdated = response.data.meta.project_stats.structure_last_updated;
                    } catch (e) {
                        console.log(e);
                        reject();
                        return;
                    }

                    // Store the previous project structure for later comparison
                    self.previousProjectStructure = projectModel.getProjectExtra();
                    // Load updated project extra structure into project model
                    projectModel.loadExtraStructure(response.data.meta.project_extra);
                    projectModel.setLastUpdated(lastUpdated);

                    console.log('updating project');
                    // Update the project
                    databaseUpdateService.updateProject(
                        projectModel.getProjectRef(),
                        projectExtra,
                        projectMapping,
                        lastUpdated
                    ).then(function () {
                        // Now update entries
                        console.log('updated project');

                        console.log('updating entries');

                        // Get the entries for a given form ref
                        function _getFormEntries (formRef) {

                            // If empty form ref, finished looping forms
                            if (formRef === '') {

                                // Lastly, check if any forms have been removed and delete those entries
                                for (previousFormRef in self.previousProjectStructure.forms) {
                                    if (Object.prototype.hasOwnProperty.call(self.previousProjectStructure.forms, previousFormRef)) {
                                        // Form doesn't exist in new structure, but did in previous structure
                                        if (!projectModel.getExtraForm(previousFormRef)) {
                                            console.log('form ' + previousFormRef + ' to be removed');
                                            // Add this previous form ref into formsToBeRemoved array
                                            formsToBeRemoved.push(previousFormRef);
                                        }
                                    }
                                }

                                // Remove the form entries that are now redundant
                                databaseDeleteService.deleteFormEntries(projectModel.getProjectRef(), formsToBeRemoved).then(
                                    function () {
                                        // Then resolve
                                        // Attempt to update the project logo
                                        downloadFileService.downloadProjectLogo(projectModel.getSlug(), projectModel.getProjectRef()).then(
                                            function () {
                                                console.log('downloaded logo');
                                                resolve(self.changeMade);
                                                // Reset changeMade back to false
                                                self.changeMade = false;
                                            },
                                            function () {
                                                console.log('didnt download logo');
                                                resolve(self.changeMade);
                                                // Reset changeMade back to false
                                                self.changeMade = false;
                                            }
                                        );
                                    }
                                );
                                return;
                            }

                            // Otherwise still forms to loop
                            self.selectAndUpdateEntries(formRef).then(
                                // Move on to the next form's entries
                                function () {
                                    console.log('successfully updated entries for form: ' + formRef);
                                    _getFormEntries(projectModel.getNextFormRef(formRef));
                                },
                                function () {
                                    console.log('failed updated entries for form: ' + formRef);
                                    _getFormEntries(projectModel.getNextFormRef(formRef));
                                });
                        }

                        // Start process of updating, via entries for first form
                        _getFormEntries(projectModel.getFirstFormRef());

                    }, function (error) {
                        // Error
                        reject(error);
                    });
                }, function (error) {
                    // Error
                    reject(error);
                });
        });
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
     * Organise the branch inputs into flat array
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
