import { PARAMETERS } from '@/config';
import * as services from '@/services';
import { useRootStore } from '@/stores/root-store';

export async function fetchBranchEntries (params) {

    const rootStore = useRootStore();
    const { inputRef, uuid, entriesOffset, filters } = params;
    const branchEntries = [];
    const uuids = [];
    let hasUnsavedBranches = false;


    //if PWA, get branch entries from store, simulating offset and limit
    if (rootStore.device.platform === PARAMETERS.PWA) {

        let branchEntriesPWA = [];
        if (Object.prototype.hasOwnProperty.call(rootStore.queueTempBranchEntriesPWA, inputRef)) {
            branchEntriesPWA = rootStore.queueTempBranchEntriesPWA[inputRef].slice(entriesOffset, entriesOffset + PARAMETERS.ENTRIES_PER_PAGE);
        }
        return {
            branchEntries: branchEntriesPWA,
            hasUnsavedBranches // <- always false for PWA
        };
    }
    else {

        //get branch entries chunk for this BRANCH question
        const result = await services.databaseSelectService.selectBranchesForQuestion(
            uuid,
            inputRef,
            PARAMETERS.ENTRIES_PER_PAGE,
            entriesOffset,
            filters,
            filters.status
        );

        if (result.rows.length > 0) {
            for (let i = 0; i < result.rows.length; i++) {

                const entryUuid = result.rows.item(i).entry_uuid;

                if (result.rows.item(i).temp === 1) {
                    hasUnsavedBranches = true;
                }

                if (uuids.indexOf(entryUuid) < 0) {
                    //uuid not found, add branch entry
                    branchEntries.push({
                        title: result.rows.item(i).title,
                        entry_uuid: entryUuid,
                        synced: result.rows.item(i).synced,
                        created_at: result.rows.item(i).created_at
                    });
                    //keep track of uuids so we avoif duplicates
                    //we do this because we can have the same entry in both the branch_entries
                    //and the temp_branhc_entries tables, during an edit
                    uuids.push(entryUuid);
                }
            }
        }
        //check if any entry has some media file sync failure (i.e file not saved or missing)
        const mediaResult = await services.databaseSelectService.selectEntryMediaErrors(
            uuids
        );

        if (branchEntries.length > 0) {
            for (let index = 0; index < mediaResult.rows.length; index++) {
                const entry_uuid = mediaResult.rows.item(index).entry_uuid;

                for (let innerIndex = 0; innerIndex < branchEntries.length; innerIndex++) {
                    if (branchEntries[innerIndex].entry_uuid === entry_uuid) {
                        branchEntries[innerIndex].hasMediaError = true;
                    }
                }
            }
        }

        return { branchEntries, hasUnsavedBranches };
    }
}
