import { useDBStore } from '@/stores/db-store';
import { PARAMETERS } from '@/config';

export const databaseUpdateService = {

    updateRows(query, params) {
        const dbStore = useDBStore();
        return new Promise((resolve, reject) => {

            function _onError(tx, error) {
                console.log('*** ' + query + '--------------------***');
                console.log(error);
                reject(error);
            }

            dbStore.db.transaction(function (tx) {
                tx.executeSql(query, params, function (tx, res) {
                    resolve(res);
                }, _onError);
            }, _onError);
        });
    },

    async updateSynced(type, entryUuid, sync, syncedError) {

        let table = 'entries';
        if (type === PARAMETERS.BRANCH_ENTRY) {
            table = 'branch_entries';
        }
        let query = 'UPDATE ' + table + ' SET synced=?';
        const params = [sync];

        if (syncedError) {
            query += ',synced_error=?';
            params.push(JSON.stringify(syncedError));
        }

        query += ' WHERE entry_uuid = ?';
        params.push(entryUuid);

        return await this.updateRows(query, params);
    },
    async updateEntrySynced(entryUuid, sync, syncedError) {

        let query = 'UPDATE entries SET synced=?';
        const params = [sync];

        if (syncedError) {
            query += ',synced_error=?';
            params.push(JSON.stringify(syncedError));
        }

        query += ' WHERE entry_uuid = ?';
        params.push(entryUuid);

        return await this.updateRows(query, params);
    },
    async updateBranchEntrySynced(entryUuid, sync, syncedError) {

        let query = 'UPDATE branch_entries SET synced=?';
        const params = [sync];

        if (syncedError) {
            query += ',synced_error=?';
            params.push(JSON.stringify(syncedError));
        }

        query += ' WHERE entry_uuid = ?';
        params.push(entryUuid);

        return await this.updateRows(query, params);
    },
    //Update the sync status of a media row and the error it carries.
    //The two synced_error assignments are mutually exclusive: a media row is
    //either in error (the upload failed) or synced (it succeeded), never both,
    //so the column is written at most once per statement.
    //A failed upload records the error; a successful upload clears the error
    //left by a previous attempt, so the entry stops showing a stale failure:
    //media errors are surfaced by synced_error alone, with no check on synced
    //(databaseSelectService.selectEntryMediaErrors).
    //Sole caller: uploadMediaService, which never passes an error together
    //with the SYNCED status.
    async updateFileEntrySynced(fileId, sync, syncedError) {

        let query = 'UPDATE media SET synced=?';
        const params = [sync];

        if (syncedError) {
            //the upload failed: record the error
            query += ', synced_error=?';
            params.push(JSON.stringify(syncedError));
        } else if (sync === PARAMETERS.SYNCED_CODES.SYNCED) {
            //the upload succeeded: clear the error from a previous attempt
            query += ', synced_error=?';
            params.push('');
        }

        query += ' WHERE id = ?';
        params.push(fileId);

        return await this.updateRows(query, params);
    },
    async updateFileEntryIncomplete(uuid) {

        let query = 'UPDATE media SET synced=?';
        const params = [PARAMETERS.SYNCED_CODES.UNSYNCED];

        query += ' WHERE entry_uuid=? and synced=?';
        params.push(uuid, PARAMETERS.SYNCED_CODES.INCOMPLETE);

        return await this.updateRows(query, params);
    },
    //Unsync all entries (that aren't incomplete).
    //No can_edit filter: non-editable remote rows are included even though the
    //uploader never sends them (it only re-marks them synced), so this is not a
    //missing project-version guard. See docs/ARCHITECTURE.md "Native Upload".
    async unsyncAllEntries(projectRef) {

        const query = 'UPDATE entries SET synced=?, synced_error=? WHERE project_ref=? AND synced <?';
        const params = [0, '', projectRef, PARAMETERS.SYNCED_CODES.INCOMPLETE];

        return await this.updateRows(query, params);
    },
    async unsyncAllFileEntries(projectRef) {

        const query = 'UPDATE media SET synced=?, synced_error=? WHERE project_ref=?';
        const params = [0, '', projectRef];

        return await this.updateRows(query, params);
    },
    /**
     * Synced status will actually be set to HAS_UNSYNCED_CHILD_ENTRIES if already synced
     * Otherwise ignored
     */
    async unsyncParentEntry(projectRef, parentEntryUuid) {
        // We only want to update the parent synced flag if it is SYNCED
        // All other statuses need to be resolved (incomplete, error) and if it is already UNSYNCED, we can ignore
        const query = 'UPDATE entries SET synced=?, synced_error=? WHERE project_ref=? AND entry_uuid=? AND synced =?';
        const params = [PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES, '', projectRef, parentEntryUuid, PARAMETERS.SYNCED_CODES.SYNCED];

        return await this.updateRows(query, params);
    },
    async unsyncAllBranchEntries(projectRef) {

        const query = 'UPDATE branch_entries SET synced=?, synced_error=? WHERE project_ref=? AND synced <?';
        const params = [0, '', projectRef, PARAMETERS.SYNCED_CODES.INCOMPLETE];

        return await this.updateRows(query, params);
    },

    async updateProject(projectRef, jsonExtra, mapping, lastUpdated) {

        const query = 'UPDATE projects SET json_extra=?, mapping=?, last_updated=? WHERE project_ref=?';

        const params = [
            jsonExtra,
            mapping,
            lastUpdated,
            projectRef
        ];
        return await this.updateRows(query, params);
    },

    async updateEntryAnswers(table, entryId, entryAnswers) {

        switch (table) {
            case PARAMETERS.BRANCH_ENTRIES_TABLE:
                table = PARAMETERS.BRANCH_ENTRIES_TABLE;
                break;
            default:
                table = PARAMETERS.ENTRIES_TABLE;
        }

        const query = 'UPDATE ' + table + ' SET answers=? WHERE id=?';

        const params = [
            entryAnswers,
            entryId
        ];

        return await this.updateRows(query, params);
    }
};