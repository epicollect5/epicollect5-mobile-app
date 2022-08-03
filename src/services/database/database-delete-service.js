
import { useDBStore } from '@/stores/db-store';


export const databaseDeleteService = {

    async deleteRowsFromMultipleTables (query, options, tables) {
        const dbStore = useDBStore();
        return new Promise((resolve, reject) => {

            function _onError (tx, error) {
                console.log('*** ' + query + '--------------------***');
                console.log(error);
                reject(error);
            }

            dbStore.db.transaction(function (tx) {

                tables.forEach((table) => {

                    const params = [];
                    let query = 'DELETE FROM ' + table;

                    if (options.project_ref !== null) {
                        query += ' WHERE project_ref=?';
                        params.push(options.project_ref);

                        if (options.entry_uuid !== null) {
                            query += ' AND entry_uuid=?';
                            params.push(options.entry_uuid);
                        }

                        if (options.form_ref !== null) {
                            query += ' AND form_ref=?';
                            params.push(options.form_ref);
                        }

                    } else {
                        if (options.entry_uuid !== null) {
                            query += ' WHERE entry_uuid=?';
                            params.push(options.entry_uuid);
                        }
                    }

                    tx.executeSql(query, params, (tx, res) => {
                        console.log(res);
                        console.log('*** deleted ---------------***');
                        // continue
                        resolve(res);
                    }, _onError);
                });
            }, _onError);
        });
    },

    async deleteRows (query, params) {
        const dbStore = useDBStore();
        return new Promise((resolve, reject) => {

            function _onError (tx, error) {
                console.log('*** ' + query + '--------------------***');
                console.log(error);
                reject(error);
            }

            dbStore.db.transaction((tx) => {
                tx.executeSql(query, params, (tx, res) => {
                    resolve(res);
                }, _onError);
            }, _onError);
        });
    },
    //delete a project and all its entries
    async deleteProject (projectRef) {

        const query = '';
        const tables = [
            'projects',
            'entries',
            'branch_entries',
            'temp_branch_entries',
            'temp_unique_answers',
            'unique_answers',
            'media',
            'bookmarks'
        ];

        const options = {
            project_ref: projectRef,
            form_ref: null,
            entry_uuid: null
        };

        return await this.deleteRowsFromMultipleTables(query, options, tables);
    },
    //remove all entries for a project
    async deleteEntries (projectRef) {

        const query = '';
        const tables = ['entries', 'branch_entries', 'temp_branch_entries', 'unique_answers', 'media', 'bookmarks'];

        const options = {
            project_ref: projectRef,
            form_ref: null,
            entry_uuid: null
        };

        return await this.deleteRowsFromMultipleTables(query, options, tables);
    },

    //Function to remove all entries for the given array of forms
    async deleteFormEntries (projectRef, formRefs) {

        const query = '';
        const tables = ['entries', 'branch_entries', 'temp_branch_entries', 'unique_answers', 'media', 'bookmarks'];

        const options = {
            project_ref: projectRef,
            entry_uuid: null,
            form_ref: null
        };

        return new Promise(function (resolve, reject) {

            function _deleteFormEntries (formRef) {

                if (!formRef) {
                    console.log('no form refs left');
                    resolve();
                    return;
                }

                options.form_ref = formRef;

                this.deleteRowsFromMultipleTables(query, options, tables).then(() => {
                    console.log('going through _deleteRowsFromMultipleTables with formref: ' + formRef);
                    // Go to next form
                    _deleteFormEntries(formRefs.pop());
                });
            }

            if (formRefs.length === 0) {
                console.log('resolving _deleteFormEntries');
                resolve();
            } else {
                // Start with the first form in the formRefs array
                _deleteFormEntries(formRefs.pop());
            }
        });
    },

    async deleteSyncedEntries (projectRef) {
        //todo: call deleteEntry recursively
    },

    //remove a single entry
    async deleteEntry (entryUuid) {

        const dbStore = useDBStore();
        let query = '';
        const tables = {
            entries: ['entry_uuid=?', [entryUuid]],
            branch_entries: ['owner_entry_uuid=?', [entryUuid]],
            unique_answers: ['entry_uuid=? OR owner_entry_uuid=?', [entryUuid, entryUuid]],
            bookmarks: ['parent_entry_uuid=?', [entryUuid]]
        };

        return new Promise((resolve, reject) => {

            dbStore.db.transaction((tx) => {
                //todo: test this
                for (const [table, value] of Object.entries(tables)) {
                    query = 'DELETE FROM ' + table + ' WHERE ' + value[0];
                    tx.executeSql(query, value[1], (tx, res) => {
                        console.log('deleted from ' + table + ' row  with uuid: ' + entryUuid);
                        resolve(res);
                    }, (tx, error) => {
                        console.log(error);
                        reject(error);
                    });
                }

                // angular.forEach(tables, function (value, table) {
                //     query = 'DELETE FROM ' + table + ' WHERE ' + value[0];
                //     tx.executeSql(query, value[1], function (tx, res) {
                //         console.log('deleted from ' + table + ' row  with uuid: ' + entryUuid);
                //         resolve(res);
                //     }, function (tx, error) {
                //         console.log(error);
                //         reject(error);
                //     });
                // });
            }, (error) => {
                console.log(error);
                reject(error);
            });
        });
    },

    //remove a single branch entry
    async deleteBranchEntry (entryUuid) {

        const query = '';
        const tables = ['branch_entries', 'temp_branch_entries', 'unique_answers', 'temp_unique_answers'];
        const options = {
            project_ref: null,
            form_ref: null,
            entry_uuid: entryUuid
        };

        return await this.deleteRowsFromMultipleTables(query, options, tables);
    },

    // Function to remove stored jwt
    async deleteToken () {

        const query = 'DELETE FROM users';

        return await this.deleteRows(query, []);
    },

    async removeUniqueAnswers (entries) {

        const dbStore = useDBStore();

        return new Promise((resolve, reject) => {

            dbStore.db.transaction((tx) => {

                const uuids = [];
                let query = '';

                for (let i = 0; i < entries.rows.length; i++) {
                    uuids.push(entries.rows.item(i).entry_uuid);
                }

                if (uuids.length === 0) {
                    resolve();
                }

                query = 'DELETE FROM unique_answers WHERE entry_uuid IN (';

                uuids.forEach((uuid, index) => {
                    if (index === (uuids.length - 1)) {
                        query += ' ? )';
                    }
                    else {
                        query += ' ?,';
                    }
                });

                // angular.forEach(uuids, function (uuid, index) {
                //     if (index === (uuids.length - 1)) {
                //         query += ' ? )';
                //     }
                //     else {
                //         query += ' ?,';
                //     }
                // });

                tx.executeSql(query, uuids, (tx, res) => {
                    resolve(res);
                }, (tx, error) => {
                    console.log(error);
                    reject(error);
                });
            }, (error) => {
                console.log(error);
                reject(error);
            });
        });
    },

    async deleteTempBranchEntries () {

        const query = 'DELETE FROM temp_branch_entries';

        return await this.deleteRows(query, []);
    },

    async deleteTempUniqueAnswers () {

        const query = 'DELETE FROM temp_unique_answers';

        return await this.deleteRows(query, []);
    },

    async deleteBookmark (bookmarkId) {

        const query = 'DELETE FROM bookmarks WHERE id=?';
        const params = [bookmarkId];

        return await this.deleteRows(query, params);
    },

    async deleteEntryMedia (entryUuid) {

        const query = 'DELETE FROM media WHERE entry_uuid=?';
        const params = [entryUuid];

        return await this.deleteRows(query, params);
    },

    async deleteMediaFile (entryUuid, fileName) {

        const query = 'DELETE FROM media WHERE entry_uuid=? AND file_name=?';
        const params = [entryUuid, fileName];

        return await this.deleteRows(query, params);
    },

    async deleteMediaFiles (entryUuid, fileNames) {

        const query = 'DELETE FROM media WHERE entry_uuid=? AND file_name IN (' + fileNames.join(',') + ')';
        const params = [entryUuid];

        return await this.deleteRows(query, params);
    }
};