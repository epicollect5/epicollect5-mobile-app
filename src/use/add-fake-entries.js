import { projectModel } from '@/models/project-model.js';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { formModel } from '@/models/form-model.js';
import * as services from '@/services';

export async function addFakeEntries (params) {
    return new Promise((resolve, reject) => {
        const { formRef, parentEntryUuid, parentFormRef } = params;
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;

        (async () => {

            // Show loader
            await services.notificationService.showProgressDialog(labels.wait);

            //todo add a popup to ask how many so we do not recompile ;)
            const howManyEntries = PARAMETERS.HOW_MANY_ENTRIES;
            const howManyBranches = PARAMETERS.HOW_MANY_BRANCH_ENTRIES;
            let currentBranchIndex;
            const branches = [];

            // Loop branches and create flat array
            for (const [key, value] of Object.entries(formModel.formStructure.branch)) {
                branches.push(key);
            }

            function _addFakeHierarchyEntry (i) {
                currentBranchIndex = 0;

                // Set up a new entry
                services.entryService.setUpNew(formRef, parentEntryUuid, parentFormRef);
                // Add fake answers for all questions in this entry
                console.log(i + '. - adding fake entry for ' + services.entryService.entry.entryUuid);

                services.entryCommonService
                    .addFakeAnswers(
                        services.entryService.entry,
                        services.entryService.form.inputs.slice(0), //pass a copy to keep the original array intact
                        i
                    )
                    .then(function () {
                        function _addFakeBranchEntry (j) {
                            // If we have any branches
                            if (branches[currentBranchIndex]) {
                                console.log(
                                    j + '. - adding fake branch for ' + services.entryService.entry.entryUuid
                                );
                                // Set up a new entry
                                services.branchEntryService.setUpNew(
                                    formModel.formRef,
                                    branches[currentBranchIndex],
                                    services.entryService.entry.entryUuid
                                );

                                const branchInputs = projectModel.getBranches(
                                    formModel.formRef,
                                    branches[currentBranchIndex]
                                );

                                // Add fake answers for all questions in this branch entry
                                services.entryCommonService
                                    .addFakeAnswers(
                                        services.branchEntryService.entry,
                                        branchInputs.slice(0), //pass copy to keep original array intact
                                        j
                                    )
                                    .then(function () {
                                        // Save the entry
                                        services.branchEntryService.saveEntry(PARAMETERS.SYNCED_CODES.UNSYNCED);

                                        if (j < howManyBranches) {
                                            // Increment this branch entry count
                                            j++;
                                            // Hit this function again
                                            _addFakeBranchEntry(j);
                                        } else {
                                            // Increment to the next branch
                                            currentBranchIndex++;
                                            // Reset branch entry count
                                            // Hit this function again
                                            _addFakeBranchEntry(1);
                                        }
                                    });
                            } else {
                                //Save the whole entry
                                services.entryService
                                    .saveEntry(PARAMETERS.SYNCED_CODES.UNSYNCED)
                                    .then(function () {
                                        if (i < howManyEntries) {
                                            i++;
                                            _addFakeHierarchyEntry(i);
                                        } else {
                                            // hide loader
                                            services.notificationService.hideProgressDialog();
                                            resolve();
                                        }
                                    });
                            }
                        }
                        //add branch entries if any
                        _addFakeBranchEntry(1);
                    });
            }
            _addFakeHierarchyEntry(1);
        })();
    });

}