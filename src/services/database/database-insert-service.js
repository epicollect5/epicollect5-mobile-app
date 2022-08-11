import { utilsService } from '@/services/utilities/utils-service';
import { useRootStore } from '@/stores/root-store';
import { useDBStore } from '@/stores/db-store';

export const databaseInsertService = {

    async insertRows (query, params) {
        const dbStore = useDBStore();
        return new Promise((resolve, reject) => {

            function _onError (tx, error) {
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

    async insertProject (projectSlug, projectName, projectRef, jsonExtra, serverUrl, lastUpdated, mapping) {

        const query = 'INSERT INTO projects (slug, name, project_ref, json_extra, server_url, last_updated, mapping) VALUES (?,?,?,?,?,?,?)';
        const params = [
            projectSlug,
            projectName,
            projectRef,
            jsonExtra,
            serverUrl,
            lastUpdated,
            mapping
        ];

        return await this.insertRows(query, params);
    },

    // Function to save a jwt token and user name

    async insertUser (jwt, name, email) {

        const query = 'INSERT INTO users (jwt, name, email) VALUES (?,?,?)';
        const params = [jwt, name, email];

        return await this.insertRows(query, params);
    },

    //Function to save a complete entry

    async insertEntry (entry, syncType) {

        let params = [];
        let query = '';
        query += 'INSERT OR REPLACE INTO entries (';
        query += 'entry_uuid, ';
        query += 'parent_entry_uuid, ';
        query += 'project_ref, ';
        query += 'form_ref, ';
        query += 'parent_form_ref, ';
        query += 'answers, ';
        query += 'synced, ';
        query += 'synced_error, ';
        query += 'can_edit, ';
        query += 'is_remote, ';
        query += 'created_at, ';
        query += 'updated_at, ';
        query += 'title) ';
        query += 'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';

        params = [
            entry.entryUuid,
            entry.parentEntryUuid,
            entry.projectRef,
            entry.formRef,
            entry.parentFormRef,
            JSON.stringify(entry.answers),
            syncType,//synced
            '',//synced_error
            entry.canEdit,//can_edit
            entry.isRemote ? entry.isRemote : 0,//is_remote
            (entry.createdAt ? entry.createdAt : utilsService.getISODateTime()),//created_at
            entry.updatedAt ? entry.updatedAt : utilsService.getISODateTime(),//updated_at
            (entry.title !== '' ? entry.title.trim() : entry.entryUuid)
        ];

        return await this.insertRows(query, params);
    },

    async insertMedia (entry, files, syncType) {

        const dbStore = useDBStore();
        let query = '';
        query += 'INSERT OR REPLACE INTO media (';
        query += 'entry_uuid, ';
        query += 'branch_entry_uuid, ';
        query += 'input_ref, ';
        query += 'project_ref, ';
        query += 'form_ref, ';
        query += 'file_name, ';
        query += 'file_path, ';
        query += 'file_type, ';
        query += 'synced,';
        query += 'synced_error) ';
        query += 'VALUES (?,?,?,?,?,?,?,?,?,?)';

        let find_file_query = 'SELECT id, COUNT(id) as count FROM media ';
        find_file_query += 'WHERE project_ref=? ';
        find_file_query += 'AND entry_uuid=? ';
        find_file_query += 'AND file_name=? ';

        const set_file_unsynced_query = 'UPDATE media SET synced=?, synced_error=? WHERE file_name = ?';

        return new Promise((resolve, reject) => {

            const rootStore = useRootStore();

            //wrap multiple executeSQL in single transaction, resolve when all done
            dbStore.db.transaction(function (tx) {
                console.log('insertMedia files');
                console.log(files);
                //loop all media files
                files.forEach((file) => {

                    const filename = file.stored === '' ? file.cached : file.stored;
                    const file_path = rootStore.persistentDir + utilsService.getFilePath(file.type);
                    console.log('insertMedia value');

                    //hack: we forgot the uniqueness check on the media table for filename,
                    //so do not save any rows where the filename already exists
                    tx.executeSql(find_file_query, [entry.projectRef, entry.entryUuid, filename], function (tx, res) {

                        //if the filename is not found, insert, otherwise update ans set unsynced
                        if (res.rows.item(0).count === 0) {
                            tx.executeSql(query, [
                                entry.entryUuid,
                                (file.entry_uuid !== entry.entryUuid ? file.entry_uuid : ''), // if the media uuid is different to the main entry uuid, we have a branch here
                                file.input_ref,
                                entry.projectRef,
                                entry.formRef,
                                filename,
                                file_path,
                                file.type,
                                syncType,
                                ''
                            ], function (tx, res) {
                                // inserted ok
                                console.log(res);
                                resolve(res);
                            }, function (tx, error) {
                                console.log(error);
                                reject(error);
                            });
                        }
                        else {
                            //file exists but it was updated: set as unsynced for upload
                            tx.executeSql(set_file_unsynced_query, [0, '', filename], function (tx, res) {
                                //unsynced ok
                                // inserted ok
                                console.log(res);
                                resolve(res);
                            }, function (tx, error) {
                                console.log(tx, error);
                                reject(error);
                            });
                        }
                    }, function (tx, error) {
                        console.log(tx, error);
                        reject(error);
                    });
                });
            }, function (error) {
                console.log(error);
                reject(error);
            }, function (res) {
                resolve(res);
            });
        });
    },

    /**
     * Function to move branch entries from the temporary table to the main one
     */
    async moveBranchEntries () {

        let query = '';
        query += 'INSERT OR REPLACE INTO branch_entries (';
        query += 'entry_uuid, ';
        query += 'owner_entry_uuid, ';
        query += 'owner_input_ref, ';
        query += 'project_ref, ';
        query += 'form_ref, ';
        query += 'answers, ';
        query += 'synced, ';
        query += 'synced_error, ';
        query += 'can_edit, ';
        query += 'is_remote, ';
        query += 'created_at, ';
        query += 'updated_at, ';
        query += 'title) ';
        query += 'SELECT ';
        query += 'entry_uuid, ';
        query += 'owner_entry_uuid, ';
        query += 'owner_input_ref, ';
        query += 'project_ref, ';
        query += 'form_ref, ';
        query += 'answers, ';
        query += 'synced, ';
        query += 'synced_error, ';
        query += 'can_edit, ';
        query += 'is_remote, ';
        query += 'created_at, ';
        query += 'updated_at, ';
        query += 'title ';
        query += 'FROM temp_branch_entries';

        console.log('Moving temp branches: ');
        return new Promise((resolve, reject) => {
            this.insertRows(query, []).then(() => {
                // Now remove entries from the temporary table
                query = 'DELETE FROM temp_branch_entries';
                console.log('Deleting temp branches: ');
                this.insertRows(query, []).then((res) => {
                    resolve(res);
                });
            });
        });
    },

    //Function to temporarily save a branch entry
    async insertTempBranchEntry (branchEntry, syncType) {

        let params = [];
        let query = '';
        query += 'INSERT OR REPLACE INTO temp_branch_entries (';
        query += 'entry_uuid, ';
        query += 'owner_entry_uuid, ';
        query += 'owner_input_ref, ';
        query += 'project_ref, ';
        query += 'form_ref, ';
        query += 'answers, ';
        query += 'synced, ';
        query += 'synced_error, ';
        query += 'can_edit, ';
        query += 'is_remote, ';
        query += 'created_at, ';
        query += 'updated_at, ';
        query += 'title) ';
        query += 'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';

        params = [
            branchEntry.entryUuid,
            branchEntry.ownerEntryUuid,
            branchEntry.ownerInputRef,
            branchEntry.projectRef,
            branchEntry.formRef,
            JSON.stringify(branchEntry.answers),
            syncType,//synced
            '',
            1,
            0,
            (branchEntry.createdAt ? branchEntry.createdAt : utilsService.getISODateTime()),
            utilsService.getISODateTime(),
            (branchEntry.title !== '' ? branchEntry.title.trim() : branchEntry.entryUuid)
        ];

        return await this.insertRows(query, params);
    },

    //Function to save unique answers for an entry
    async insertUniqueAnswers (entry, useTemporaryTable) {

        const dbStore = useDBStore();
        const table = useTemporaryTable ? 'temp_unique_answers' : 'unique_answers';
        let query = '';
        query += 'INSERT OR REPLACE INTO ' + table + ' (';
        query += 'project_ref, ';
        query += 'form_ref, ';
        query += 'entry_uuid, ';
        query += 'input_ref, ';
        query += 'parent_entry_uuid, ';
        query += 'owner_entry_uuid, ';
        query += 'answer )';
        query += 'VALUES (?,?,?,?,?,?,?)';

        return new Promise((resolve, reject) => {

            dbStore.db.transaction((tx) => {
                // Loop all unique answers
                for (const [key, value] of Object.entries(entry.uniqueAnswers)) {
                    tx.executeSql(query, [
                        entry.projectRef,
                        entry.formRef,
                        entry.entryUuid,
                        key,
                        entry.parentEntryUuid,
                        entry.ownerEntryUuid,
                        value
                    ], (tx, res) => {
                        // Inserted ok
                        console.log(res);
                        resolve(res);
                    }, (tx, error) => {
                        console.log(error);
                        reject(error);
                    });
                }
            }, (error) => {
                console.log(error);
                reject(error);
            }, (res) => {
                resolve(res);
            });
        });
    },

    //Function to move branch entries from the temporary table to the main one
    async moveUniqueAnswers () {

        let query = '';
        query += 'INSERT OR REPLACE INTO unique_answers (';
        query += 'project_ref, ';
        query += 'form_ref, ';
        query += 'entry_uuid, ';
        query += 'input_ref, ';
        query += 'parent_entry_uuid, ';
        query += 'owner_entry_uuid, ';
        query += 'answer) ';
        query += 'SELECT ';
        query += 'project_ref, ';
        query += 'form_ref, ';
        query += 'entry_uuid, ';
        query += 'input_ref, ';
        query += 'parent_entry_uuid, ';
        query += 'owner_entry_uuid, answer ';
        query += 'FROM temp_unique_answers';

        console.log('Moving temp unique answers: ');
        return new Promise((resolve) => {
            this.insertRows(query, []).then(() => {
                // Now remove entries from the temporary table
                query = 'DELETE FROM temp_unique_answers';
                console.log('Deleting temp answers: ');
                this.insertRows(query, []).then((res) => {
                    resolve(res);
                });
            });
        });
    },

    //Function to insert a setting field-value
    async insertSetting (field, value) {
        const query = 'INSERT OR REPLACE INTO settings (field, value) VALUES (?,?)';
        const params = [field, value];



        return await this.insertRows(query, params);
    },

    async insertBookmark (projectRef, formRef, title, bookmark, parentEntryUuid) {

        if (!parentEntryUuid) {
            parentEntryUuid = '';
        }

        const query = 'INSERT OR REPLACE INTO bookmarks (project_ref, form_ref, parent_entry_uuid, title, bookmark) VALUES (?,?,?,?,?)';
        const params = [projectRef, formRef, parentEntryUuid, title, bookmark];

        return await this.insertRows(query, params);
    }
};