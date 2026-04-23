import { useDBStore } from '@/stores/db-store';
import { PARAMETERS } from '@/config';
import { databaseSelectService } from '@/services/database/database-select-service';

//get entries for a form
export async function fetchEntries(params) {

    const dbStore = useDBStore();
    const entries = [];
    const allMediaUuids = [];
    const branchMediaUuids = [];
    const { formRef, parentEntryUuid, currentEntryOffset, filters, projectRef } = params;
    const order = dbStore.dbEntriesOrder;

    //is there any unsynced entry project wide?
    const resultEntriesUnsynced = await databaseSelectService.countEntriesUnsynced(projectRef);
    const totalEntriesUnsynced = resultEntriesUnsynced.rows.item(0).total;
    const resultMediaUnsynced = await databaseSelectService.countMediaUnsynced(projectRef);
    const totalMediaUnsynced = resultMediaUnsynced.rows.item(0).total;
    const hasUnsyncedEntries = (totalEntriesUnsynced > 0 || totalMediaUnsynced > 0);

    const result = await databaseSelectService.selectEntries(
        projectRef,
        formRef,
        parentEntryUuid,
        order,
        PARAMETERS.ENTRIES_PER_PAGE,
        currentEntryOffset,
        filters,
        filters.status
    );

    for (let i = 0; i < result.rows.length; i++) {
        const title = result.rows.item(i).title;

        entries.push({
            title: title,
            entry_uuid: result.rows.item(i).entry_uuid,
            synced: result.rows.item(i).synced,
            can_edit: result.rows.item(i).can_edit,
            is_remote: result.rows.item(i).is_remote,
            created_at: result.rows.item(i).created_at,
            has_media_error: false
        });

        allMediaUuids.push(result.rows.item(i).entry_uuid);
    }

    //get all branches belonging to each entry (mediaUuids now contains only the hierarchy entries)
    const branches = await databaseSelectService.selectBranches(allMediaUuids);
    //add branch entries uuids to the media uuids
    for (let branchesIndex = 0; branchesIndex < branches.rows.length; branchesIndex++) {
        branchMediaUuids.push({
            entry_uuid: branches.rows.item(branchesIndex).entry_uuid,
            owner_entry_uuid: branches.rows.item(branchesIndex).owner_entry_uuid
        });
        //merge branches media uuid to all medi uuids for look up
        allMediaUuids.push(branches.rows.item(branchesIndex).entry_uuid);
    }

    //find all media errors and also count hierarchy entries (the latter for pagination)
    const mediaErrors = await databaseSelectService.selectEntryMediaErrorsByForm(projectRef, formRef);


    //check if any entry has some media file sync failure (i.e. file not saved or missing)
    if (entries.length > 0) {
        for (let index = 0; index < entries.length; index++) {
            for (let innerIndex = 0; innerIndex < mediaErrors.rows.length; innerIndex++) {
                const entry_uuid = mediaErrors.rows.item(innerIndex).entry_uuid;

                //check if there is a hierarchy entry media error
                if (entries[index].entry_uuid === entry_uuid) {
                    entries[index].hasMediaError = true;
                }

                //check if there is a branch media error belonging to this hierarchy entry
                for (let y = 0; y < branchMediaUuids.length; y++) {
                    if (
                        entries[index].entry_uuid ===
                        branchMediaUuids[y].owner_entry_uuid
                    ) {
                        entries[index].hasMediaError = true;
                    }
                }
            }
        }
    }

    return {
        entries,
        allMediaUuids,
        branchMediaUuids,
        hasUnsyncedEntries
    };
}
