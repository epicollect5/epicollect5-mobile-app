import { useRootStore } from '@/stores/root-store';
import { useDBStore } from '@/stores/db-store';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';

export const databaseSelectService = {

    async getRows(query, params) {
        const dbStore = useDBStore();
        return new Promise((resolve, reject) => {

            function _onError(tx, error) {
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

    //Select a value based on a supplied key, from the settings table
    async selectSetting(field) {
        const query = 'SELECT value FROM settings WHERE field=?';
        const params = [field];

        return await this.getRows(query, params);
    },

    async getUser() {
        const query = 'SELECT * FROM users';
        return await this.getRows(query, []);
    },

    async selectProject(projectRef) {
        const query = 'SELECT * FROM projects WHERE project_ref = ?';
        const params = [projectRef];

        return await this.getRows(query, params);
    },

    // Function to get all stored projects

    async selectProjects() {
        const query = 'SELECT project_ref, name FROM projects';
        return await this.getRows(query, []);
    },
    //Get one entry for a given form ref or parent entry uuid
    async selectOneEntry(projectRef, formRef, parentEntryUuid, synced, offset) {

        let query = 'SELECT entry_uuid, parent_entry_uuid, answers, form_ref, parent_form_ref, created_at, title, synced, can_edit, is_remote FROM entries WHERE project_ref = ?';
        const params = [projectRef];

        if (formRef) {
            query += ' AND form_ref=?';
            params.push(formRef);
        }

        if (parentEntryUuid !== null) {
            query += ' AND parent_entry_uuid=?';
            params.push(parentEntryUuid);
        }

        if (synced !== null) {
            // params.push(synced);
            // query += ' AND synced=?';
            const sync = [];
            query += ' AND synced IN (';
            for (let i = 0; i < synced.length; i++) {
                sync.push('?');
                params.push(synced[i]);
            }
            query += sync.join(',') + ') ';

        }

        query += ' LIMIT 1 ';
        //console.log(params);
        //console.log(query);

        if (offset !== null) {
            query += ' OFFSET ' + offset + ' ';
        }

        return await this.getRows(query, params);
    },

    async selectOneBranchEntry(projectRef, ownerEntryUuid, synced) {

        let query = '';
        query += 'SELECT entry_uuid, ';
        query += 'owner_entry_uuid, ';
        query += 'answers, ';
        query += 'form_ref, ';
        query += 'owner_input_ref, ';
        query += 'created_at, ';
        query += 'title, ';

        query += 'synced, ';
        query += 'can_edit, ';
        query += 'is_remote ';
        query += 'FROM branch_entries ';
        query += 'WHERE project_ref = ? ';
        query += 'AND owner_entry_uuid=? ';

        const params = [projectRef, ownerEntryUuid];

        if (synced !== null) {
            //synced must be 1 or 0
            query += ' AND synced=?';
            params.push(synced);
        }

        query += 'LIMIT 1';

        return await this.getRows(query, params);
    },

    async selectOneBranchEntryForExport(projectRef, ownerInputRef, offset) {

        let query = '';
        query += 'SELECT entry_uuid, ';
        query += 'owner_entry_uuid, ';
        query += 'answers, ';
        query += 'form_ref, ';
        query += 'owner_input_ref, ';
        query += 'created_at, ';
        query += 'title, ';
        query += 'synced, ';
        query += 'can_edit, ';
        query += 'is_remote ';
        query += 'FROM branch_entries ';
        query += 'WHERE project_ref = ? ';
        query += 'AND owner_input_ref=? ';

        const params = [projectRef, ownerInputRef];

        query += 'LIMIT 1';
        query += ' OFFSET ' + offset + ' ';

        return await this.getRows(query, params);
    },

    async selectBranchEntry(entryUuid) {

        let query = '';
        query += 'SELECT * ';
        query += 'FROM branch_entries ';
        query += 'WHERE entry_uuid=? ';
        query += 'UNION ';
        query += 'SELECT * ';
        query += 'FROM temp_branch_entries ';
        query += 'WHERE entry_uuid=?';
        query += 'ORDER BY updated_at';

        const params = [entryUuid, entryUuid];

        return await this.getRows(query, params);
    },
    // Count unsynced entries (entries+ branch entries) for a project
    async countUnsyncedEntries(projectRef) {

        let query = '';
        //total_number_of_entries
        query += 'SELECT ((SELECT COUNT(entry_uuid) as no_entries';
        query += ' FROM entries ';
        query += 'WHERE project_ref = ? ';
        query += ') + ';
        query += '(SELECT COUNT(entry_uuid) as no_entries ';
        query += 'FROM branch_entries ';
        query += 'WHERE project_ref = ? ';
        query += ')) as total_number_of_entries, ';
        //---------------------------------------------------

        //total_number_of_entries_with_errors
        query += '((SELECT COUNT(entry_uuid) as no_entries ';
        query += 'FROM entries ';
        query += 'WHERE project_ref = ? ';
        query += 'AND synced=?) + ';
        query += '(SELECT COUNT(entry_uuid) as no_entries ';
        query += 'FROM branch_entries ';
        query += 'WHERE project_ref = ? ';
        query += 'AND synced=?)) as total_number_of_entries_with_errors,';
        //---------------------------------------------------------------

        //total_number_of_entries_unsynced
        query += '((SELECT COUNT(entry_uuid) as no_entries ';
        query += 'FROM entries ';
        query += 'WHERE project_ref = ? ';
        query += 'AND (synced = ? OR synced = ?)) + ';//todo: is this needed for branches?
        query += '(SELECT COUNT(entry_uuid) as no_entries ';
        query += 'FROM branch_entries ';
        query += 'WHERE project_ref = ? ';
        query += 'AND synced=?)) as total_number_of_entries_unsynced,';
        //-------------------------------------------------------------

        //total_number_of_incomplete_entries
        query += '((SELECT COUNT(entry_uuid) as no_entries ';
        query += 'FROM entries ';
        query += 'WHERE project_ref = ? ';
        query += 'AND synced=?) + ';
        query += '(SELECT COUNT(entry_uuid) as no_entries ';
        query += 'FROM branch_entries ';
        query += 'WHERE project_ref = ? ';
        query += 'AND synced=?)) as total_number_of_incomplete_entries';
        //-------------------------------------------------------------

        const params = [
            //total_number_of_entries
            projectRef,
            projectRef,
            //-----------------------

            //total_number_of_entries_with_errors
            projectRef,
            PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR,
            projectRef,
            PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR,
            //---------------------------------------

            //total_number_of_entries_unsynced
            projectRef,
            PARAMETERS.SYNCED_CODES.UNSYNCED,
            PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES,
            projectRef,
            PARAMETERS.SYNCED_CODES.UNSYNCED,
            //-------------------------------------------------

            //total_number_of_incomplete_entries
            projectRef,
            PARAMETERS.SYNCED_CODES.INCOMPLETE,
            projectRef,
            PARAMETERS.SYNCED_CODES.INCOMPLETE
            //----------------------------------
        ];

        return await this.getRows(query, params);
    },
    async countUnsyncedBranchEntries(projectRef, ownerEntryUuid) {

        let query = '';
        query += 'SELECT COUNT(entry_uuid) as count ';
        query += 'FROM branch_entries ';
        query += 'WHERE project_ref = ? AND owner_entry_uuid= ? ';
        query += 'AND synced= ?';

        const params = [
            projectRef,
            ownerEntryUuid,
            PARAMETERS.SYNCED_CODES.UNSYNCED
        ];

        return await this.getRows(query, params);
    },
    //Count unsynced media entries for a project
    async countUnsyncedMediaEntries(projectRef) {

        let query = '';
        query += 'SELECT (SELECT COUNT(entry_uuid) ';
        query += 'FROM media ';
        query += 'WHERE project_ref = ? ';
        query += 'AND synced = ? ';
        query += 'AND file_type = ?) ';
        query += 'as total_number_of_photos,';
        query += '(SELECT COUNT(entry_uuid) ';
        query += 'FROM media ';
        query += 'WHERE project_ref = ? ';
        query += 'AND synced = ? AND file_type = ?) ';
        query += 'as total_number_of_videos,';
        query += '(SELECT COUNT(entry_uuid) ';
        query += 'FROM media ';
        query += 'WHERE project_ref = ? ';
        query += 'AND synced = ? ';
        query += 'AND file_type = ?) ';
        query += 'as total_number_of_audio';

        const params = [
            projectRef,
            0,
            'photo',
            projectRef,
            0,
            'video',
            projectRef,
            0,
            'audio'
        ];

        return await this.getRows(query, params);
    },
    //Function to get an entry
    async selectEntry(entryUuid, parentEntryUuid) {

        const params = [entryUuid];
        let query = '';
        query += 'SELECT ';
        query += 'entry_uuid, ';
        query += 'answers, ';
        query += 'form_ref, ';
        query += 'parent_form_ref, ';
        query += 'parent_entry_uuid, ';
        query += 'project_ref, ';
        query += 'created_at, ';
        query += 'title, ';

        query += 'synced, ';
        query += 'synced_error, ';
        query += 'can_edit, ';
        query += 'is_remote ';
        query += 'FROM entries ';
        query += 'WHERE entry_uuid = ?';

        if (parentEntryUuid) {
            query += ' AND parent_entry_uuid = ?';
            params.push(parentEntryUuid);
        }

        return await this.getRows(query, params);
    },
    //get entries for a project
    async selectEntries(projectRef, formRef, parentEntryUuid, order, limit, offset, filters, status) {

        let query = 'SELECT id, entry_uuid, title, synced, can_edit, is_remote, answers, created_at FROM entries WHERE project_ref = ?';
        const params = [projectRef];
        let dbField;
        let dbSortType;

        if (formRef) {
            query += ' AND form_ref = ?';
            params.push(formRef);
        }

        if (parentEntryUuid) {
            query += ' AND parent_entry_uuid = ?';
            params.push(parentEntryUuid);
        }

        //do not bind filters
        if (filters) {
            if (filters.title) {
                query += ' AND title LIKE \'%' + filters.title + '%\'';
            }

            if (filters.from && filters.to) {
                //we do this because there were problems with getting entries on the same date
                //but with different times
                const from = filters.from + 'T00:00:00.000Z';
                const to = filters.to + 'T23:59:59.999Z';
                query += ' AND created_at BETWEEN \'' + from + '\' AND \'' + to + '\'';
            }
        }

        //filter by synced status (when not ALL)
        if (status) {
            if (status !== PARAMETERS.STATUS.ALL) {
                switch (status) {
                    case PARAMETERS.STATUS.INCOMPLETE:
                        query += ' AND synced= ?';
                        params.push(PARAMETERS.SYNCED_CODES.INCOMPLETE);
                        break;

                    case PARAMETERS.STATUS.ERROR:
                        query += ' AND synced= ?';
                        params.push(PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR);
                        break;
                }
            }
        }

        if (order) {
            // Sanitise the field and sort type, as they will be used in db queries
            dbField = PARAMETERS.ALLOWED_ORDERING_COLUMNS.indexOf(order.field) > -1 ? order.field : PARAMETERS.DEFAULT_ORDERING_COLUMN;
            dbSortType = PARAMETERS.ALLOWED_ORDERING.indexOf(order.sortType) > -1 ? order.sortType : PARAMETERS.DEFAULT_ORDERING;

            //imp: tested this on Android and iOS -> not working
            // if (rootStore.device.platform !== PARAMETERS.WEB) {
            //     query += ' ORDER BY ' + dbField + ' COLLATE LOCALIZED ' + dbSortType;
            //     //todo: COLLATE NOCASE -> test it
            // }
            //  else {
            query += ' ORDER BY ' + dbField + ' ' + dbSortType;
            //  }
        }

        if (limit) {
            query += ' LIMIT ? ';
            params.push(limit);
        }
        if (offset) {
            query += ' OFFSET ? ';
            params.push(offset);
        }

        console.log(query);

        return await this.getRows(query, params);
    },
    //count entries unsynced for a project (entries + branch_entries)
    async countEntriesUnsynced(projectRef) {
        let query = 'SELECT SUM(total) as total from ( ';
        query += ' SELECT count(id) as total FROM entries ';
        query += ' WHERE project_ref = ? AND (synced = ? OR synced = ? OR synced = ? ) ';
        query += ' UNION ALL ';
        query += ' SELECT count(id) as total FROM branch_entries ';
        query += ' WHERE project_ref = ? AND (synced = ? OR synced = ? OR synced = ? ) ';
        query += ' ) ';

        const params = [
            projectRef,
            PARAMETERS.SYNCED_CODES.UNSYNCED,
            PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES,
            PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR,
            projectRef,
            PARAMETERS.SYNCED_CODES.UNSYNCED,
            PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES,
            PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR
        ];

        return await this.getRows(query, params);
    },
    async countMediaUnsynced(projectRef) {
        const query = 'SELECT count(id) as total FROM media WHERE project_ref = ? AND (synced = ? OR synced = ?  OR synced = ?)';
        const params = [
            projectRef,
            PARAMETERS.SYNCED_CODES.UNSYNCED,
            PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES,
            PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR
        ];

        return await this.getRows(query, params);
    },
    //Function to count entries for a project/form/parent entry uuid
    async countEntries(projectRef, formRef, parentEntryUuid, filters, status) {

        let query = 'SELECT COUNT(*) as total, MAX(created_at) as newest, MIN(created_at) as oldest FROM entries WHERE project_ref = ?';
        const params = [projectRef];

        if (formRef) {
            query += ' AND form_ref = ?';
            params.push(formRef);
        }

        if (parentEntryUuid) {
            query += ' AND parent_entry_uuid = ?';
            params.push(parentEntryUuid);
        }

        //do not bind filters!
        if (filters) {
            if (filters.title) {
                query += ' AND title LIKE \'%' + filters.title + '%\'';
            }

            //filter by dates
            if (filters.from && filters.to) {
                const from = filters.from + 'T00:00:00.000Z';
                const to = filters.to + 'T23:59:59.999Z';
                query += ' AND created_at BETWEEN \'' + from + '\' AND \'' + to + '\'';
            }
        }

        //filter by synced status (when not ALL)
        if (status) {
            if (status !== PARAMETERS.STATUS.ALL) {
                switch (status) {
                    case PARAMETERS.STATUS.INCOMPLETE:
                        query += ' AND synced= ?';
                        params.push(PARAMETERS.SYNCED_CODES.INCOMPLETE);
                        break;

                    case PARAMETERS.STATUS.ERROR:
                        query += ' AND synced= ?';
                        params.push(PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR);
                        break;
                }
            }
        }

        return await this.getRows(query, params);
    },
    //Function to get entries for a project
    async selectBranchEntries(projectRef, formRef, ownerInputRef, order) {

        const rootStore = useRootStore();
        let query = 'SELECT id, entry_uuid, title, synced, can_edit, answers FROM branch_entries WHERE project_ref = ?';
        const params = [projectRef];
        let dbField;
        let dbSortType;

        if (formRef) {
            query += ' AND form_ref = ?';
            params.push(formRef);
        }

        if (ownerInputRef) {
            query += ' AND owner_input_ref = ?';
            params.push(ownerInputRef);
        }

        if (order) {
            // Sanitise the field and sort type, as they will be used in db queries
            dbField = PARAMETERS.ALLOWED_ORDERING_COLUMNS.indexOf(order.field) > -1 ? order.field : PARAMETERS.DEFAULT_ORDERING_COLUMN;
            dbSortType = PARAMETERS.ALLOWED_ORDERING.indexOf(order.sortType) > -1 ? order.sortType : PARAMETERS.DEFAULT_ORDERING;
            if (rootStore.device.platform !== PARAMETERS.WEB) {
                //imp:test on device
                query += ' ORDER BY ' + dbField + ' COLLATE LOCALIZED ' + dbSortType;
                //todo: COLLATE NOCASE -> test it
            }
            else {
                query += ' ORDER BY ' + dbField + ' ' + dbSortType;
            }
        }

        return await this.getRows(query, params);
    },
    async selectBranches(ownerEntryUuids) {

        let query = '';
        query += 'SELECT ';
        query += 'entry_uuid, ';
        query += 'owner_entry_uuid, ';
        query += 'title, ';

        query += 'owner_input_ref, ';
        query += 'form_ref, ';
        query += 'answers, ';
        query += 'project_ref, ';
        query += 'synced, ';
        query += 'can_edit, ';
        query += 'is_remote, ';
        query += 'created_at ';
        query += 'FROM branch_entries ';
        query += 'WHERE owner_entry_uuid=?';
        const params = [ownerEntryUuids[0]];
        //copy array of uuids not to tamper the original one
        const ownerEntryUuidsCopy = ownerEntryUuids.slice(0);

        //bail out if no uuids to look up
        if (ownerEntryUuids.length === 0) {
            return new Promise((resolve) => {
                resolve({
                    rows: {
                        length: 0
                    }
                });
            });
        }

        //add all the uuids (SELECT IN (?) never worked, so we use OR)
        if (ownerEntryUuids.length > 1) {
            ownerEntryUuidsCopy.shift();

            ownerEntryUuidsCopy.forEach((uuid) => {
                params.push(uuid);
                query += ' OR owner_entry_uuid = ?';
            });
            // angular.forEach(ownerEntryUuidsCopy, function (uuid) {
            //     params.push(uuid);
            //     query += ' OR owner_entry_uuid = ?';
            // });
        }
        return await this.getRows(query, params);
    },
    async selectTempBranches(ownerEntryUuid) {

        const query = 'SELECT entry_uuid FROM temp_branch_entries WHERE owner_entry_uuid = ?';
        const params = [ownerEntryUuid];

        return await this.getRows(query, params);
    },
    //this select from both branch _entries and temp_branch_entries
    async selectBranchesForQuestion(ownerEntryUuid, ownerInputRef, limit, offset, filters, status) {

        let query = '';
        const params = [ownerEntryUuid, ownerInputRef, ownerEntryUuid, ownerInputRef];

        query += 'SELECT * ';
        query += 'FROM (';
        query += 'SELECT entry_uuid, ';
        query += 'title, ';

        query += 'synced, ';
        query += '1 as temp, ';
        query += 'created_at ';
        query += 'FROM temp_branch_entries ';
        query += 'WHERE owner_entry_uuid = ? ';
        query += 'AND owner_input_ref=? ';

        //do not bind filters
        if (filters) {
            if (filters.title) {
                query += ' AND title LIKE \'%' + filters.title + '%\' ';
            }

            //filter by dates
            if (filters.from && filters.to) {
                const from1 = filters.from + 'T00:00:00.000Z';
                const to1 = filters.to + 'T23:59:59.999Z';
                query += ' AND created_at BETWEEN \'' + from1 + '\' AND \'' + to1 + '\' ';
            }
        }

        //filter by synced status (when set and not ALL)
        if (status) {
            if (status !== PARAMETERS.STATUS.ALL) {
                switch (status) {
                    case PARAMETERS.STATUS.INCOMPLETE:
                        query += ' AND synced=' + PARAMETERS.SYNCED_CODES.INCOMPLETE.toString() + ' ';
                        break;

                    case PARAMETERS.STATUS.ERROR:
                        query += ' AND synced=' + PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR.toString() + ' ';
                        break;
                }
            }
        }

        query += 'ORDER BY created_at DESC) ';
        query += 'ALIAS_ONE ';
        query += 'UNION ALL SELECT * ';
        query += 'FROM ';
        query += '(SELECT entry_uuid, ';
        query += 'title, ';

        query += 'synced, ';
        query += '0 as temp, ';
        query += 'created_at ';
        query += 'FROM branch_entries ';
        query += 'WHERE owner_entry_uuid = ? ';
        query += 'AND owner_input_ref=? ';

        //do not bind filters!
        if (filters) {
            if (filters.title) {
                query += ' AND title LIKE \'%' + filters.title + '%\' ';
            }

            //filter by dates
            if (filters.from && filters.to) {
                const from2 = filters.from + 'T00:00:00.000Z';
                const to2 = filters.to + 'T23:59:59.999Z';
                query += ' AND created_at BETWEEN \'' + from2 + '\' AND \'' + to2 + '\' ';
            }
        }

        //filter by synced status (when set and not ALL)
        if (status) {
            if (status !== PARAMETERS.STATUS.ALL) {
                switch (status) {
                    case PARAMETERS.STATUS.INCOMPLETE:
                        query += ' AND synced=' + PARAMETERS.SYNCED_CODES.INCOMPLETE.toString() + ' ';
                        break;

                    case PARAMETERS.STATUS.ERROR:
                        query += ' AND synced=' + PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR.toString() + ' ';
                        break;
                }
            }
        }

        query += 'ORDER BY created_at DESC) ';
        query += 'ALIAS_TWO';


        if (limit) {
            query += ' LIMIT ? ';
            params.push(limit);
        }
        if (offset) {
            query += ' OFFSET ? ';
            params.push(offset);
        }

        return await this.getRows(query, params);
    },
    async countBranchesForQuestion(ownerEntryUuid, ownerInputRef, filters, status) {

        const params = [ownerEntryUuid, ownerInputRef, ownerEntryUuid, ownerInputRef];
        let query = '';
        //imp: COUNT(DISTINCT(entry_uuid)) since we can have a temp branch with the 
        //imp: same uuid when editing an existing branch
        query += 'SELECT COUNT(DISTINCT(entry_uuid)) as total, MAX(created_at) as newest, MIN(created_at) as oldest FROM ( ';
        query += 'SELECT * ';
        query += 'FROM (';
        query += 'SELECT entry_uuid, ';
        query += 'title, ';
        query += 'created_at, ';
        query += 'synced, ';
        query += '1 as temp ';
        query += 'FROM temp_branch_entries ';
        query += 'WHERE owner_entry_uuid = ? ';
        query += 'AND owner_input_ref=? ';

        //do not bind filters!
        if (filters) {
            if (filters.title) {
                query += ' AND title LIKE \'%' + filters.title + '%\' ';
            }

            //filter by dates
            if (filters.from && filters.to) {
                const from1 = filters.from + 'T00:00:00.000Z';
                const to1 = filters.to + 'T23:59:59.999Z';
                query += ' AND created_at BETWEEN \'' + from1 + '\' AND \'' + to1 + '\' ';
            }
        }

        //filter by synced status (when is set and not ALL)
        if (status) {
            if (status !== PARAMETERS.STATUS.ALL) {
                switch (status) {
                    case PARAMETERS.STATUS.INCOMPLETE:
                        query += ' AND synced=' + PARAMETERS.SYNCED_CODES.INCOMPLETE.toString() + ' ';
                        break;

                    case PARAMETERS.STATUS.ERROR:
                        query += ' AND synced=' + PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR.toString() + ' ';
                        break;
                }
            }
        }

        query += 'ORDER BY created_at DESC) ';
        query += 'ALIAS_ONE ';
        query += 'UNION ALL SELECT * ';
        query += 'FROM ';
        query += '(SELECT entry_uuid, ';
        query += 'title, ';

        query += 'created_at, ';
        query += 'synced, ';
        query += '0 as temp ';
        query += 'FROM branch_entries ';
        query += 'WHERE owner_entry_uuid = ? ';
        query += 'AND owner_input_ref=? ';

        //do not bind filters!
        if (filters) {
            if (filters.title) {
                query += ' AND title LIKE \'%' + filters.title + '%\' ';
            }

            //filter by dates
            if (filters.from && filters.to) {
                const from2 = filters.from + 'T00:00:00.000Z';
                const to2 = filters.to + 'T23:59:59.999Z';
                query += ' AND created_at BETWEEN \'' + from2 + '\' AND \'' + to2 + '\' ';
            }
        }

        //filter by synced status (when set and not ALL)
        if (status) {
            if (status !== PARAMETERS.STATUS.ALL) {
                switch (status) {
                    case PARAMETERS.STATUS.INCOMPLETE:
                        query += ' AND synced=' + PARAMETERS.SYNCED_CODES.INCOMPLETE.toString() + ' ';
                        break;

                    case PARAMETERS.STATUS.ERROR:
                        query += ' AND synced=' + PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR.toString() + ' ';
                        break;
                }
            }
        }

        query += 'ORDER BY created_at DESC) ';
        query += 'ALIAS_TWO';
        query += ' );';

        console.log(query);
        console.log(params);

        return await this.getRows(query, params);
    },
    //Select all the media files belonging to an entry (hierarchy or branch)
    async selectEntryMedia(projectRef, entryUuid) {

        const dbStore = useDBStore();
        const query = 'SELECT file_name, input_ref, file_type, file_path, entry_uuid, branch_entry_uuid FROM media WHERE project_ref=? AND entry_uuid=?';
        const params = [projectRef, entryUuid];
        let i;
        const media = [];

        return new Promise((resolve, reject) => {
            function _onError(error) {
                console.log(error);
                reject();
            }

            dbStore.db.transaction(function (tx) {
                tx.executeSql(query, params, function (tx, res) {
                    for (i = 0; i < res.rows.length; i++) {
                        media.push(res.rows.item(i));
                    }
                    resolve(media);
                }, _onError);
            }, _onError);
        });
    },
    async selectEntryMediaErrors(entryUuids, limit) {

        let query = 'SELECT entry_uuid, input_ref, synced_error FROM media WHERE (entry_uuid=? ';

        //bail out if no uuids to look up
        if (entryUuids.length === 0) {
            return new Promise(function (resolve) {
                resolve({
                    rows: {
                        length: 0
                    }
                });
            });
        }

        if (entryUuids.length > 1) {
            for (let index = 1; index < entryUuids.length; index++) {
                query += 'OR entry_uuid=? ';
            }
            query += ') ';
        }
        else {
            query += ') ';
        }

        query += 'AND (ifnull(length(synced_error), 0) > 0)';

        if (limit) {
            query += ' LIMIT ' + limit;
        }

        //    console.log(query);

        return await this.getRows(query, entryUuids);
    },
    /**
    *
    * Count the media errors for branches passing the owner_input_ref
    * which is the ref of the branch
    */
    async countCurrentBranchMediaErrors(owner_input_ref) {

        let query = 'SELECT count(*) as total, input_ref, synced_error FROM media WHERE input_ref LIKE "' + owner_input_ref + '%" ';

        query += 'AND (ifnull(length(synced_error), 0) > 0)';

        //  console.log(query);

        return await this.getRows(query);
    },
    // Select all the media files belonging to a project, grouping them by file type i.e. audio, video, photo
    async selectProjectMedia(options) {

        const dbStore = useDBStore();
        let query = 'SELECT * FROM media WHERE project_ref=? ';
        let i;
        const audios = [];
        const photos = [];
        const videos = [];
        const params = [options.project_ref];

        if (options.synced !== null) {
            query += 'AND synced=? ';
            params.push(options.synced);
        }

        if (options.entry_uuid !== null) {
            query += 'AND entry_uuid IN (?) ';
            params.push(options.entry_uuid.join(','));
        }

        query += 'AND file_type=? ';

        //return an object with an array per each file type
        return new Promise((resolve, reject) => {
            function _onSuccess() {
                resolve({
                    audios: audios,
                    photos: photos,
                    videos: videos
                });
            }

            function _onError(error) {
                console.log(error);
                reject();
            }

            dbStore.db.transaction(function (tx) {
                tx.executeSql(query, params.concat(PARAMETERS.QUESTION_TYPES.AUDIO), function (tx, res) {
                    for (i = 0; i < res.rows.length; i++) {
                        audios.push(res.rows.item(i));
                    }
                }, _onError);
                tx.executeSql(query, params.concat(PARAMETERS.QUESTION_TYPES.PHOTO), function (tx, res) {
                    for (i = 0; i < res.rows.length; i++) {
                        photos.push(res.rows.item(i));
                    }
                }, _onError);
                tx.executeSql(query, params.concat(PARAMETERS.QUESTION_TYPES.VIDEO), function (tx, res) {
                    for (i = 0; i < res.rows.length; i++) {
                        videos.push(res.rows.item(i));
                    }
                }, _onError);
            }, _onError, _onSuccess);
        });
    },
    // Check if an answer is unique, Check against type of uniqueness
    async isUnique(entry, inputDetails, answer) {
        // Check uniqueness against input_ref and answer (by default, 'form' uniqueness)
        // Ignoring a unique answer for the same entry_uuid
        // for DATE & TIME question type, the check is a LIKE %needle%
        let query1 = '';
        let query2 = '';
        let params = [];

        switch (inputDetails.type) {
            case PARAMETERS.QUESTION_TYPES.DATE:
                //get date part only
                answer = answer.substring(0, 11);
                //amswer is now is now like "2011-10-05T"

                switch (inputDetails.datetime_format) {
                    // DATE_FORMAT_4: 'MM/YYYY',
                    case PARAMETERS.DATE_FORMAT_4:
                        //get YYYY-MM- part only
                        answer = answer.substring(0, 8);
                        //now it is like "2011-10-"
                        break;
                    // DATE_FORMAT_5: 'dd/MM',
                    case PARAMETERS.DATE_FORMAT_5:
                        answer = answer.substring(4, 11);
                        //answer is now like "-10-05T"
                        break;
                    default:
                    //
                }
                query1 = 'SELECT answer FROM unique_answers WHERE input_ref=? AND answer LIKE ? AND entry_uuid<>?';
                query2 = 'SELECT answer FROM temp_unique_answers WHERE input_ref=? AND answer LIKE ? AND entry_uuid<>?';
                params = [inputDetails.ref, '%' + answer + '%', entry.entryUuid];
                break;
            case PARAMETERS.QUESTION_TYPES.TIME: {
                //time answers are like "2011-10-05T14:48:00.000"
                let timePart = answer.substring(10, 20);
                //timePart is now like "T14:48:00."
                switch (inputDetails.datetime_format) {
                    case PARAMETERS.TIME_FORMAT_3:
                        //'HH:mm'
                        timePart = timePart.substring(0, 7);
                        //answer is now like "T14:48:"
                        break;
                    case PARAMETERS.TIME_FORMAT_4:
                        //'hh:mm'
                        timePart = timePart.substring(0, 7);
                        //answer is now like "T14:48:"
                        break;
                    case PARAMETERS.TIME_FORMAT_5:
                        //'mm:ss
                        timePart = timePart.substring(3, 10);
                        //answer is like ":48:00."
                        break;
                    default:
                    //
                }

                query1 = 'SELECT answer FROM unique_answers WHERE input_ref=? AND answer LIKE ? AND entry_uuid<>?';
                query2 = 'SELECT answer FROM temp_unique_answers WHERE input_ref=? AND answer LIKE ? AND entry_uuid<>?';
                params = [inputDetails.ref, '%' + timePart + '%', entry.entryUuid];
                break;
            }

            default:
                query1 = 'SELECT answer FROM unique_answers WHERE input_ref=? AND answer=? AND entry_uuid<>?';
                query2 = 'SELECT answer FROM temp_unique_answers WHERE input_ref=? AND answer=? AND entry_uuid<>?';
                params = [inputDetails.ref, answer, entry.entryUuid];

        }

        // If we have a 'hierarchy' uniqueness, also check against parent_entry_uuid
        if (inputDetails.uniqueness === 'hierarchy') {
            query1 += ' AND parent_entry_uuid=?';
            query2 += ' AND parent_entry_uuid=?';
            params.push(entry.parentEntryUuid);
        }

        // Check if we have a branch to compare against only those branch entries related to the same owner uuid
        if (entry.ownerEntryUuid) {
            query1 += ' AND owner_entry_uuid=?';
            query2 += ' AND owner_entry_uuid=?';
            params.push(entry.ownerEntryUuid);
        }

        const query = query1 + ' UNION ' + query2;
        params = params.concat(params);

        return await this.getRows(query, params);
    },
    //get saved answers, one at a time, for a form
    //imp: loaded one at a time to keep memory footprint low
    async getSavedAnswers(projectRef, formRef, isBranch, offset) {

        const table = isBranch ? 'branch_entries' : 'entries';
        const query = 'SELECT answers FROM ' + table + ' WHERE project_ref=? AND form_ref=? ORDER BY created_at DESC LIMIT ? OFFSET ' + offset;
        const params = [projectRef, formRef, PARAMETERS.MAX_SAVED_ANSWERS];

        return await this.getRows(query, params);
    },
    //Retrieve all unique answers for an entry
    async selectUniqueAnswers(entryUuid) {
        // Check uniqueness against input_ref and answer (by default, 'form' uniqueness)
        const query = 'SELECT answer FROM unique_answers WHERE entry_uuid=?';
        const params = [entryUuid];

        return await this.getRows(query, params);
    },
    //Retrieve parent entry uuid for an entry
    async selectParentEntry(entryUuid) {

        const query = 'SELECT parent_entry_uuid FROM entries WHERE entry_uuid=? LIMIT 1';
        const params = [entryUuid];

        return await this.getRows(query, params);
    },
    //Select bookmarks
    async selectBookmarks() {

        const query = 'Select * FROM bookmarks';

        return await this.getRows(query, []);
    },
    /**
         * When deleting an entry, we have to delete all the children down to nested levels
         * We also need to collect the branch entries for current entry and each child entry,
         * to delete any media: branch entries are delete directly passing the uuid as branch_owner_uuid
         */
    async getHierarchyEntries(entryUuid) {

        const self = this;
        let childIndex;
        let branchIndex;
        const allEntriesUuids = [];
        let childEntriesUuids = [];
        const branchEntriesUuids = [];
        let childEntryUuid;
        let branchEntryUuid;

        return new Promise((resolve, reject) => {

            function _select(entryUuids) {

                //get all child entries and branch entries for the current child entry
                //todo: test this response, migrating from $q
                Promise.all([
                    self.selectChildEntries(entryUuids),
                    //todo change selectBranches to accept array of uuids..
                    self.selectBranches(entryUuids)
                ])
                    .then(function (res) {
                        //any branch entries? -> look at res[1]
                        for (branchIndex = 0; branchIndex < res[1].rows.length; branchIndex++) {
                            //push any branch uuid found
                            branchEntryUuid = res[1].rows.item(branchIndex).entry_uuid;
                            branchEntriesUuids.push(branchEntryUuid);
                        }

                        //any child entries? -> look at res[0]
                        if (res[0].rows.length > 0) {
                            childEntriesUuids = [];
                            for (childIndex = 0; childIndex < res[0].rows.length; childIndex++) {

                                //get all child uuids
                                childEntryUuid = res[0].rows.item(childIndex).entry_uuid;

                                //store just child uuids
                                childEntriesUuids.push(childEntryUuid);

                                //store all the uuids
                                allEntriesUuids.push(childEntryUuid);

                            }
                            //per each child entry uuid, we need to call this same function recursively
                            _select(childEntriesUuids);
                        }
                        else {

                            //todo this would resolve too early.....

                            //no more children down the hierarchy, resolve
                            // Resolve with complete array of entries
                            resolve({
                                entries: allEntriesUuids,
                                branchEntries: branchEntriesUuids
                            });
                        }
                    }, function (error) {
                        console.log(error);
                        //todo reject?
                    });
            }

            //start with the passed uuid
            _select([entryUuid]);
        });
    },
    async selectChildEntries(entryUuids) {

        //SELECT IN never worked, so concat passed array of uuids
        let query = 'SELECT entry_uuid FROM entries WHERE parent_entry_uuid=?';
        //make a copy of the array passed in as js passed by reference,
        //we DO NOT want to modify the original array
        const entryUuidsCopy = entryUuids.slice(0);
        const params = [entryUuidsCopy[0]];

        if (entryUuidsCopy.length > 1) {
            //remove first uuuid
            entryUuidsCopy.shift();

            entryUuidsCopy.forEach((uuid) => {
                // Push the delete entry promises into an array
                query += ' OR parent_entry_uuid=?';
                params.push(uuid);
            });
        }
        return await this.getRows(query, params);
    },
    //Get entries with errors
    async selectErrorEntries(table, projectRef) {

        switch (table) {
            case 'branch_entries':
                table = 'branch_entries';
                break;
            default:
                table = 'entries';
        }
        const query = 'SELECT * FROM ' + table + ' WHERE project_ref=? AND synced=?';
        const params = [projectRef, -1];

        return await this.getRows(query, params);
    },
    //Get entries with errors
    async selectInvalidEntries(table, projectRef) {

        switch (table) {
            case 'branch_entries':
                table = 'branch_entries';
                break;
            default:
                table = 'entries';
        }
        const query = 'SELECT * FROM ' + table + ' WHERE project_ref=? AND (synced=? OR synced=?)';
        const params = [
            projectRef,
            PARAMETERS.SYNCED_CODES.INCOMPLETE,
            PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR
        ];

        return await this.getRows(query, params);
    },
    //Function to get ownerInputRef with entries
    //useful to know only the branches that have entries
    async selectDistinctBranchRefs(projectRef) {
        const query = 'SELECT DISTINCT(owner_input_ref), form_ref FROM branch_entries WHERE project_ref = ?';
        const params = [projectRef];
        return await this.getRows(query, params);
    }
};