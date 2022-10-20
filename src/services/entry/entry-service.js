import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { formModel } from '@/models/form-model.js';
import { entryModel } from '@/models/entry-model';
import { useRootStore } from '@/stores/root-store';
import { Capacitor } from '@capacitor/core';
import * as services from '@/services';
import { toRaw } from 'vue';

export const entryService = {
    type: PARAMETERS.ENTRY,
    form: {},
    entry: {},
    //Initial function to set up the entry
    setUpNew (formRef, parentEntryUuid, parentFormRef) {
        const rootStore = useRootStore();
        this.actionState = PARAMETERS.ENTRY_ADD;
        this.allowSave = true;
        this.form = formModel;
        this.entry = entryModel;

        // Initialise the entry model
        this.entry.initialise({
            entry_uuid: services.utilsService.uuid(),
            parent_entry_uuid: parentEntryUuid,
            form_ref: formRef,
            parent_form_ref: parentFormRef,
            answers: {},
            project_ref: projectModel.getProjectRef(),
            title: '',
            titles: [],
            is_remote: 0,
            synced: 2,
            synced_error: '',
            can_edit: 1,
            created_at: '',
            unique_answers: {}
        });

        // Set form details
        formModel.initialise(projectModel.getExtraForm(formRef));
        this.formIndex = projectModel.getFormIndex(formRef);
        this.formName = formModel.getName();
        this.form.inputs = projectModel.getFormInputs(formRef);

        // Watch device position only if the form has got a location input
        if (projectModel.hasLocation(formRef)) {
            if (Capacitor.isNativePlatform()) {
                // Start watching location
                rootStore.deviceGeolocation = {
                    ...rootStore.deviceGeolocation,
                    ...{
                        error: null,
                        position: null
                    }
                };

                console.log('asking for permission');
                services.locationService.requestLocationPermission();
            }
        }
    },

    // Initial function to set up the entry from an existing stored entry
    setUpExisting (entry) {

        const self = this;
        const rootStore = useRootStore();
        self.form = formModel;
        self.entry = entryModel;

        return new Promise((resolve, reject) => {
            self.actionState = PARAMETERS.ENTRY_EDIT;
            self.allowSave = true;

            // Replace entry model object
            self.entry = entry;

            // Set form details
            formModel.initialise(projectModel.getExtraForm(self.entry.formRef));
            self.formIndex = projectModel.getFormIndex(self.entry.formRef);
            self.formName = formModel.getName();
            formModel.inputs = projectModel.getFormInputs(self.entry.formRef);

            // Watch device position only if the form has got a location input
            if (projectModel.hasLocation(self.entry.formRef)) {
                if (rootStore.device.platform !== PARAMETERS.WEB) {
                    rootStore.deviceGeolocation = {
                        error: null,
                        position: null,
                        watchId: 0
                    };

                    services.locationService.requestLocationPermission();
                }
            }
            if (rootStore.device.platform !== PARAMETERS.WEB) {
                // This is a promise to be resolved BEFORE any directive is called
                services.mediaService.getEntryStoredMedia(self.entry.entryUuid).then(function (response) {
                    self.entry.media = response;
                    resolve();
                });
            } else {
                self.entry.media = {};
                resolve();
            }
        });
    },

    saveEntry (syncType) {

        const rootStore = useRootStore();
        const self = this;

        return new Promise((resolve, reject) => {
            // If this is an entry we can actually edit, i.e. not a remote entry
            if (self.entry.canEdit === 1) {
                // Set the entry title 
                services.entryCommonService.setEntryTitle(projectModel.getExtraForm(
                    self.entry.formRef),
                    projectModel.getExtraInputs(),
                    self.entry,
                    false
                );
            }

            function _onError (error) {
                console.log(error);
                reject(error);
            }

            //remove media files answers before saving the entry
            rootStore.queueFilesToDelete.forEach((file) => {
                //if we have a cached file, that will replace the one
                //we are deleting, so skip it
                if (file.filenameStored === self.entry.answers[file.inputRef].answer) {
                    self.entry.answers[file.inputRef].answer = '';
                }
            });

            // Unsync all parent entries
            this.unsyncParentEntries(projectModel.getProjectRef(), self.entry.parentEntryUuid).then(function () {

                // Save the entry in the database
                services.databaseInsertService.insertEntry(self.entry, syncType).then(function (res) {

                    // Insert any unique answers for this entry
                    services.databaseInsertService.insertUniqueAnswers(self.entry, false).then(function () {

                        // Next move over any branch entries from the temp table to the main table
                        services.databaseInsertService.moveBranchEntries(self.entry).then(function (res) {

                            // Move over temp unique answers (for branches) into unique answers table
                            services.databaseInsertService.moveUniqueAnswers().then(function (res) {

                                // If there are any media files for this entry, insert metadata into media table and save files
                                services.mediaService.saveMedia(self.entry, syncType).then(function () {
                                    console.log('All media files saved ***************************');
                                    resolve(res);
                                }, _onError);
                            }, _onError);
                        }, _onError);
                    }, _onError);
                }, _onError);
            });
        });
    },

    saveEntryPWA () {

        const rootStore = useRootStore();
        const self = this;
        self.form = formModel;
        self.entry = entryModel;
        const projectSlug = projectModel.getSlug();

        return new Promise((resolve, reject) => {

            // Set the entry title 
            services.entryCommonService.setEntryTitle(projectModel.getExtraForm(
                self.entry.formRef),
                projectModel.getExtraInputs(),
                self.entry,
                false
            );

            console.log(JSON.stringify(self.entry));

            //convert self.entry to an object identical to the one we save to the DB, 
            //so we can re-use all the functions
            const parsedEntry = {
                entry_uuid: self.entry.entryUuid,
                parent_entry_uuid: self.entry.parentEntryUuid,
                answers: JSON.stringify(self.entry.answers),
                form_ref: self.entry.formRef,
                parent_form_ref: self.entry.parentFormRef,
                created_at: services.utilsService.getISODateTime(),
                title: self.entry.title,
                synced: 0,
                can_edit: 1,
                is_remote: 0,
                last_updated: projectModel.getLastUpdated(),//<-- the project version
                device_id: '',
                platform: PARAMETERS.WEB,
                entry_type: PARAMETERS.ENTRY
            };

            console.log(JSON.stringify(parsedEntry));

            //upload entry to server
            const uploadableEntry = services.JSONTransformerService.makeJsonEntry(PARAMETERS.ENTRY, parsedEntry);

            services.webService.uploadEntryPWA(projectSlug, uploadableEntry).then((response) => {
                //any branches to upload for this entry?
                const allBranchEntries = toRaw(rootStore.queueTempBranchEntriesPWA);
                if (Object.keys(allBranchEntries).length > 0) {
                    const uploadBranchEntryPromises = [];
                    Object.values(allBranchEntries).forEach((questionBranchEntries) => {
                        questionBranchEntries.forEach(async (branchEntry) => {
                            uploadBranchEntryPromises.push(services.webService.uploadEntryPWA(projectSlug, branchEntry));
                        });
                    });

                    Promise.all(uploadBranchEntryPromises).then((response) => {
                        console.log(response);
                        resolve(response);
                        rootStore.queueTempBranchEntriesPWA = {};
                    }).catch((error) => {
                        //remove only branches already uploaded
                        //todo: how do we do it?
                        console.log(error);
                        reject(error);
                    });
                }
                else {
                    console.log(response);
                    resolve(response);
                }
            }, (error) => {
                console.log(error);
                reject(error);
            });
        });
    },

    getAnswers (inputRef) {
        return services.entryCommonService.getAnswers(this.entry, inputRef);
    },

    //Validate and append answer/title to entry object
    validateAnswer (params) {

        // For edits:
        // Check if the input has jumps
        // If the answer if different to the previous one
        // we don't show the 'quit' button
        // This is to make sure the user reaches the end of the entry
        // before saving, so the jumps and answers retain their integrity
        if (this.actionState === PARAMETERS.ENTRY_EDIT &&
            params.mainInputDetails.jumps.length > 0 &&
            (typeof this.entry.answers[params.mainInputDetails.ref] !== 'undefined' && params.current_answer !== this.entry.answers[params.mainInputDetails.ref].answer)) {
            this.allowSave = false;
        }

        //todo: test this throughly in the future...
        //For edits: check if all the required questions have an answer
        //Users can edit an existing entry, go back and save. 
        //The server would catch the missing required answer anyway
        // if (this.actionState === PARAMETERS.ENTRY_EDIT) {
        //     const inputs = projectModel.getExtraInputs();

        //     for (const [inputRef, answerObj] of Object.entries(this.entry.answers)) {
        //         if (inputs[inputRef].data.is_required === true) {
        //             if (answerObj.answer === '') {
        //                 this.allowSave = false;
        //                 break;
        //             }
        //         }
        //     }

        //    // console.log(this.entry);
        //     //console.log(params);
        // }


        return services.entryCommonService.validateAnswer(this.entry, params);
    },

    /**
     * Get the next input ref
     * Process the jumps
     * Set any answer 'was_jumped' properties to true/false
     */
    processJumpsNext (answer, inputDetails, currentInputIndex) {
        return services.entryCommonService.processJumpsNext(this.entry, answer, inputDetails, currentInputIndex, this.form.inputs);
    },

    /**
     * Get the previous input ref
     * Check for previous questions that were jumped
     */
    processJumpsPrevious (currentInputIndex) {
        return services.entryCommonService.processJumpsPrevious(this.entry, currentInputIndex, this.form.inputs);
    },

    /**
     * Unsync all parent entries for an entry
     * Synced status will actually be set to HAS_UNSYNCED_CHILD_ENTRIES
     */
    unsyncParentEntries (projectRef, parentEntryUuid) {

        return new Promise((resolve) => {

            function _unsync (entryUuid) {

                services.databaseUpdateService.unsyncParentEntry(projectRef, entryUuid).then(function () {
                    select(entryUuid);
                });
            }

            function select (entryUuid) {

                services.databaseSelectService.selectParentEntry(entryUuid).then(function (res) {

                    if (res.rows.length > 0) {
                        _unsync(res.rows.item(0).parent_entry_uuid);
                    } else {
                        resolve(res);
                    }
                });
            }

            _unsync(parentEntryUuid);
        });
    },

    removeTempBranches () {

        const self = this;
        const rootStore = useRootStore();

        return new Promise((resolve) => {

            //on PWA, just remove branches from store
            if (rootStore.device.platform === PARAMETERS.PWA) {
                rootStore.queueTempBranchEntriesPWA = {};
                resolve();
            }
            else {
                // Select all temp branch entries uuids
                services.databaseSelectService.selectTempBranches(self.entry.entryUuid).then(function (res) {

                    // Remove unique_answers, if any, for each temp branch
                    if (res.rows.length > 0) {
                        services.databaseDeleteService.removeUniqueAnswers(res).then(function () {
                            // Then delete all temp branch entries
                            services.databaseDeleteService.deleteTempBranchEntries().then(function () {
                                // Finished, resolve
                                resolve();
                            });
                        });
                    } else {
                        // No temp branches, resolve
                        resolve();
                    }
                });
            }
        });
    }
};
