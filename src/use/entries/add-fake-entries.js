import { projectModel } from '@/models/project-model.js';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { formModel } from '@/models/form-model.js';
import { notificationService } from '@/services/notification-service';
import { entryCommonService } from '@/services/entry/entry-common-service';
import { entryService } from '@/services/entry/entry-service';
import { branchEntryService } from '@/services/entry/branch-entry-service';
import { utilsService } from '@/services/utilities/utils-service';
import { fakeAnswerService } from '@/services/entry/fake-answer-service';

export async function showFakeRegexWarningIfNeeded () {
    if (!PARAMETERS.DEBUG) {
        return;
    }
    if (fakeAnswerService.failedRegexPatterns.length === 0) {
        return;
    }
    const details = fakeAnswerService.failedRegexPatterns
        .map((failed) => '"' + failed.question + '" (' + failed.regex + ')'
            + (failed.required ? ' [required]' : '')
            + (failed.serverIncompatible ? ' [breaks server validation]' : ''))
        .join('<br>');
    const requiredCount = fakeAnswerService.failedRegexPatterns.filter((failed) => failed.required).length;
    const message = requiredCount > 0
        ? 'Fake answers could not be generated for ' + fakeAnswerService.failedRegexPatterns.length + ' regex question(s) (left empty). Upload may fail for the ' + requiredCount + ' required one(s):<br><br>' + details
        : 'Fake answers could not be generated for ' + fakeAnswerService.failedRegexPatterns.length + ' regex question(s) (left empty):<br><br>' + details;
    await notificationService.showAlert(message, 'Fake regex answers skipped');
}

export async function addFakeEntries (params) {
    return new Promise((resolve, reject) => {
        const { formRef, parentEntryUuid, parentFormRef } = params;
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;

        (async () => {

            // Show loader
            await notificationService.showProgressDialog(labels.wait);
            console.log('Fake entries run started - heap: ' + utilsService.getHeapMemoryUsage());
            fakeAnswerService.failedRegexPatterns.length = 0;

            //todo add a popup to ask how many so we do not recompile ;)
            const howManyEntries = PARAMETERS.HOW_MANY_ENTRIES;
            const howManyBranches = PARAMETERS.HOW_MANY_BRANCH_ENTRIES;
            const EPOCH_CREATED_AT = '1970-01-01T12:24:27.000Z';
            const SPREAD_DAYS = 90;
            const EPOCH_EVERY_N = 10;
            let currentBranchIndex;
            const branches = [];

            function _getDeterministicCreatedAt (index, total) {
                const denominator = Math.max(total - 1, 1);
                const dayOffset = ((index - 1) / denominator) * SPREAD_DAYS;
                const randomDate = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
                return utilsService.getISODateTime(randomDate);
            }

            // Loop branches and create flat array
            for (const [key, value] of Object.entries(formModel.formStructure.branch)) {
                branches.push(key);
            }

            function _addFakeHierarchyEntry (i) {
                currentBranchIndex = 0;

                // Set up a new entry
                entryService.setUpNew(formRef, parentEntryUuid, parentFormRef);
                // Add fake answers for all questions in this entry
                console.log(i + '. - adding fake entry for ' + entryService.entry.entryUuid);

                // Every Nth entry keeps the epoch time so we always have some epoch dates;
                // the rest are spread deterministically between today and 90 days back
                if (i % EPOCH_EVERY_N === 0) {
                    entryService.entry.createdAt = EPOCH_CREATED_AT;
                    console.warn(
                        `${i}. - created_at is epoch for entry: ${entryService.entry.entryUuid}`
                    );
                } else {
                    entryService.entry.createdAt = _getDeterministicCreatedAt(i, howManyEntries);
                }

                entryCommonService
                    .addFakeAnswers(
                        entryService.entry,
                        entryService.form.inputs.slice(0), //pass a copy to keep the original array intact
                        i
                    )
                    .then(function () {
                        function _addFakeBranchEntry (j) {
                            // If we have any branches
                            if (branches[currentBranchIndex]) {
                                console.log(
                                    j + '. - adding fake branch for ' + entryService.entry.entryUuid
                                );
                                // Set up a new entry
                                branchEntryService.setUpNew(
                                    formModel.formRef,
                                    branches[currentBranchIndex],
                                    entryService.entry.entryUuid
                                );

                                const branchInputs = projectModel.getBranches(
                                    formModel.formRef,
                                    branches[currentBranchIndex]
                                );

                                // Branch follows its parent: epoch iff the parent entry is epoch,
                                // otherwise spread deterministically between today and 90 days back
                                if (i % EPOCH_EVERY_N === 0) {
                                    branchEntryService.entry.createdAt = EPOCH_CREATED_AT;
                                    console.warn(
                                        `${i}. - created_at is epoch for BRANCH entry: ${branchEntryService.entry.entryUuid}`
                                    );
                                } else {
                                    branchEntryService.entry.createdAt = _getDeterministicCreatedAt(j, howManyBranches);
                                }

                                // Add fake answers for all questions in this branch entry
                                entryCommonService
                                    .addFakeAnswers(
                                        branchEntryService.entry,
                                        branchInputs.slice(0), //pass copy to keep original array intact
                                        j
                                    )
                                    .then(function () {
                                        // Save the entry
                                        branchEntryService.saveEntry(PARAMETERS.SYNCED_CODES.UNSYNCED);

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
                                entryService
                                    .saveEntry(PARAMETERS.SYNCED_CODES.UNSYNCED)
                                    .then(async function () {
                                        console.log(i + '. - fake entry saved - heap: ' + utilsService.getHeapMemoryUsage());
                                        if (i < howManyEntries) {
                                            i++;
                                            _addFakeHierarchyEntry(i);
                                        } else {
                                            // hide loader
                                            await notificationService.hideProgressDialog();
                                            console.log('Fake entries run completed - heap: ' + utilsService.getHeapMemoryUsage());
                                            await showFakeRegexWarningIfNeeded();
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
