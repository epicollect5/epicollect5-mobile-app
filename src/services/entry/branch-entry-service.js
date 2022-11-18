import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { formModel } from '@/models/form-model.js';
import { utilsService } from '@/services/utilities/utils-service';
import { mediaService } from '@/services/entry/media-service';
import { useRootStore } from '@/stores/root-store';
import { databaseInsertService } from '../database/database-insert-service';
import { entryCommonService } from '@/services/entry/entry-common-service';
import { databaseSelectService } from '../database/database-select-service';
import { databaseDeleteService } from '../database/database-delete-service';
import { branchEntryModel } from '@/models/branch-entry-model.js';
import { Capacitor } from '@capacitor/core';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';
import { webService } from '@/services/web-service';

export const branchEntryService = {
    type: PARAMETERS.BRANCH_ENTRY,
    form: {},
    entry: {},
    branchInputs: {},

    //Initial function to set up the branch entry
    setUpNew (formRef, ownerInputRef, ownerInputUuid) {

        this.form = formModel;
        this.entry = branchEntryModel;
        this.action = PARAMETERS.ENTRY_ADD;

        // Initialise the entry model
        this.entry.initialise({
            entry_uuid: utilsService.uuid(),
            owner_entry_uuid: ownerInputUuid,
            owner_input_ref: ownerInputRef,
            form_ref: formRef,
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

        this.branchInputs = projectModel.getBranches(this.entry.formRef, this.entry.ownerInputRef);


        // Get inputs extra details
        const inputsExtra = projectModel.getExtraInputs();
        this.branchInput = inputsExtra[this.entry.ownerInputRef].data;
    },

    //Initial function to set up the entry from an existing stored entry
    setUpExisting (entry) {
        const rootStore = useRootStore();
        const self = this;

        self.form = formModel;
        self.entry = branchEntryModel;
        return new Promise((resolve, reject) => {

            this.action = PARAMETERS.ENTRY_EDIT;

            // Replace entry model object with that supplied
            this.entry = entry;

            this.branchInputs = projectModel.getBranches(this.entry.formRef, this.entry.ownerInputRef);

            // Get inputs extra details
            const inputsExtra = projectModel.getExtraInputs();
            this.branchInput = inputsExtra[this.entry.ownerInputRef].data;

            if (Capacitor.isNativePlatform()) {
                // This is a promise to be resolved BEFORE any directive is called
                mediaService.getEntryStoredMedia(self.entry.entryUuid).then(function (response) {
                    self.entry.media = response;
                    resolve();
                });
            } else {
                //todo: handle PWA
                self.entry.media = {};
                resolve();
            }
        });
    },

    // Save a branch entry
    saveEntry (syncType) {

        const self = this;
        self.form = formModel;
        self.entry = branchEntryModel;

        return new Promise((resolve, reject) => {
            // Set the entry title title
            entryCommonService.setEntryTitle(
                projectModel.getExtraForm(self.entry.formRef),
                projectModel.getExtraInputs(),
                self.entry,
                true
            );

            function _onError (error) {
                console.log(error);
                reject(error);
            }

            // Save the branch entry in the temp table
            databaseInsertService.insertTempBranchEntry(self.entry, syncType).then(function (res) {

                // Insert any unique answers for this branch entry
                databaseInsertService.insertUniqueAnswers(self.entry, true).then(function () {

                    console.log('Unique answers saved in temp table');
                    console.log('Branch saved in temp table');

                    // If there are any media files for this entry, insert metadata into media table and save files
                    mediaService.saveMedia(self.entry, syncType).then(function () {
                        console.log('All media files saved ***************************');
                        resolve(res);
                    }, _onError);
                }, _onError);
            }, _onError);
        });

    },

    async saveEntryPWA () {

        //save branch entry in memory, it will be uploaded the owner entry is uploaded
        const rootStore = useRootStore();
        const projectSlug = projectModel.getSlug();
        const self = this;
        const ownerInputRef = self.entry.ownerInputRef;

        return new Promise((resolve, reject) => {

            // Set the entry title 
            entryCommonService.setEntryTitle(
                projectModel.getExtraForm(self.entry.formRef),
                projectModel.getExtraInputs(),
                self.entry,
                true
            );

            //convert self.entry to an object identical to the one we save to the DB, 
            //so we can re-use all the functions
            console.log(JSON.stringify(self.entry.answers));
            const parsedBranchEntry = {
                entry_uuid: self.entry.entryUuid,
                parent_entry_uuid: self.entry.parentEntryUuid,
                answers: JSON.stringify(self.entry.answers),
                form_ref: self.entry.formRef,
                parent_form_ref: self.entry.parentFormRef,
                created_at: utilsService.getISODateTime(),
                title: self.entry.title,
                synced: 0,
                can_edit: 1,
                is_remote: 0,
                last_updated: projectModel.getLastUpdated(),//<-- the project version
                device_id: '',
                platform: PARAMETERS.WEB,
                entry_type: PARAMETERS.BRANCH_ENTRY,
                owner_input_ref: ownerInputRef,
                owner_entry_uuid: self.entry.ownerEntryUuid
            };

            console.log(JSON.stringify(parsedBranchEntry));

            //conver entry to upload format
            const uploadableBranchEntry = JSONTransformerService.makeJsonEntry(PARAMETERS.BRANCH_ENTRY, parsedBranchEntry);

            //if a remote branch, upload
            if (rootStore.branchEditType === PARAMETERS.PWA_EDIT_BRANCH_REMOTE) {
                webService.uploadEntryPWA(projectSlug, uploadableBranchEntry).then((response) => {
                    resolve(response);
                }, (error) => {
                    console.log(error);
                    reject(error);
                });
            }
            else {
                //store branch entry in memory
                if (!Object.prototype.hasOwnProperty.call(rootStore.queueTempBranchEntriesPWA, ownerInputRef)) {
                    rootStore.queueTempBranchEntriesPWA[ownerInputRef] = [];
                }

                //if edit, replace current temp branch entry
                if (branchEntryService.action === PARAMETERS.ENTRY_EDIT) {
                    const existingBranchEntries = rootStore.queueTempBranchEntriesPWA[ownerInputRef];
                    const index = existingBranchEntries.findIndex((branch) => {
                        return branch.id === self.entry.entryUuid;
                    });
                    rootStore.queueTempBranchEntriesPWA[ownerInputRef][index] = uploadableBranchEntry;
                }
                else {
                    //new branch, just add it
                    rootStore.queueTempBranchEntriesPWA[ownerInputRef].push(uploadableBranchEntry);
                }
                resolve();
            }
        });
    },

    //Validate and append answer/title to entry object
    validateAnswer (params) {
        return entryCommonService.validateAnswer(this.entry, params);
    },

    getAnswers (inputRef) {
        return entryCommonService.getAnswers(this.entry, inputRef);
    },

    /**
     * Get the next input ref
     * Process the jumps
     * Set any answer 'was_jumped' properties to true/false
     */
    processJumpsNext (answer, inputDetails, currentInputIndex) {
        return entryCommonService.processJumpsNext(this.entry, answer, inputDetails, currentInputIndex, this.branchInputs);
    },

    /**
     * Get the previous input ref
     * Check for previous questions that were jumped
     */
    processJumpsPrevious (currentInputIndex) {
        return entryCommonService.processJumpsPrevious(this.entry, currentInputIndex, this.branchInputs);
    },

    //remove temp branch entries when quitting hierachy entry 
    removeTempBranches () {

        const self = this;
        const rootStore = useRootStore();

        return new Promise((resolve) => {

            //if editing existing entry and quitting, just bail out
            //as no changes need to be made
            if (self.action === PARAMETERS.ENTRY_EDIT) {
                resolve();
                return false;
            }

            //on PWA, just remove branches from store
            if (rootStore.isPWA) {
                rootStore.queueTempBranchEntriesPWA = {};
                resolve();
            }
            else {
                //on native app, delete them from database

                //when quitting a branch entry, there are not temp branches to remove
                if (self.type === PARAMETERS.BRANCH_ENTRY) {
                    resolve();
                    return false;
                }
                // Select all temp branch entries uuids
                databaseSelectService.selectTempBranches(self.entry.entryUuid).then(function (res) {
                    // Remove unique_answers, if any, for each temp branch
                    if (res.rows.length > 0) {
                        databaseDeleteService.removeUniqueAnswers(res).then(function () {
                            // Then delete all temp branch entries
                            databaseDeleteService.deleteTempBranchEntries().then(function () {
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
