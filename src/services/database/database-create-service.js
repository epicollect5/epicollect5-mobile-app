import { MIGRATIONS } from '@/config';

/**
 * Create database tables
 */
export const createDatabaseService = {

    execute (db) {
        return new Promise((resolve, reject) => {

            const _onError = (error) => {
                console.log(error);
                reject(error);
            };

            db.transaction((tx) => {
                // projects table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS projects (' +
                    'id integer primary key, ' +
                    'name text, ' +
                    'slug text, ' +
                    'logo_thumb text, ' +
                    'project_ref text, ' +
                    'json_extra text, ' +
                    'server_url text, ' +
                    'last_updated text,' +
                    'UNIQUE (project_ref, server_url)' +
                    ')', [], (res) => {
                    }, _onError);

                // users table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS users (' +
                    'id integer primary key, ' +
                    'jwt text ' +
                    ')', [], (res) => {
                    }, _onError);


                // entries table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS entries (' +
                    'id integer primary key, ' +
                    'entry_uuid text UNIQUE, ' +
                    'parent_entry_uuid text, ' +
                    'project_ref text, ' +
                    'form_ref text, ' +
                    'parent_form_ref text, ' +
                    'answers text, ' +
                    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ' +
                    'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ' +
                    'title text, ' +
                    'synced int, ' +
                    'synced_error text,' +
                    'can_edit int, ' +
                    'is_remote int' +
                    ')', [], (res) => {
                    }, _onError);

                // branch entries table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS branch_entries (' +
                    'id integer primary key, ' +
                    'entry_uuid text UNIQUE, ' +
                    'owner_entry_uuid text, ' +
                    'owner_input_ref text, ' +
                    'project_ref text, ' +
                    'form_ref text, ' +
                    'answers text, ' +
                    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ' +
                    'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ' +
                    'title text, ' +
                    'synced int, ' +
                    'synced_error text,' +
                    'can_edit int, ' +
                    'is_remote int' +
                    ')', [], (res) => {
                    }, _onError);

                // temp branch entries table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS temp_branch_entries (' +
                    'id integer primary key, ' +
                    'entry_uuid text UNIQUE, ' +
                    'owner_entry_uuid text, ' +
                    'owner_input_ref text, ' +
                    'project_ref text, ' +
                    'form_ref text, ' +
                    'answers text, ' +
                    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ' +
                    'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ' +
                    'title text, ' +
                    'synced int, ' +
                    'synced_error text,' +
                    'can_edit int, ' +
                    'is_remote int' +
                    ')', [], (res) => {
                    }, _onError);

                // media table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS media (' +
                    'id integer primary key, ' +
                    'entry_uuid text, ' +
                    'branch_entry_uuid text, ' + //empty if hierarchy entry
                    'input_ref text, ' +
                    'project_ref text, ' +
                    'form_ref text, ' +
                    'file_name text, ' + //this should have been unique!!!!!
                    'file_path text, ' +
                    'file_type text, ' +
                    'synced int, ' +
                    'synced_error text,' +
                    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
                    ')', [], (res) => {
                    }, _onError);

                // unique_answers table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS unique_answers (' +
                    'id integer primary key, ' +
                    'project_ref text, ' +
                    'entry_uuid text, ' +
                    'input_ref text, ' +
                    'parent_entry_uuid text, ' +
                    'owner_entry_uuid text, ' +
                    'answer text, ' +
                    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,' +
                    'UNIQUE (entry_uuid, input_ref)' +
                    ')', [], (res) => {
                    }, _onError);

                // temp unique_answers table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS temp_unique_answers (' +
                    'id integer primary key, ' +
                    'project_ref text, ' +
                    'entry_uuid text, ' +
                    'input_ref text, ' +
                    'parent_entry_uuid text, ' +
                    'owner_entry_uuid text, ' +
                    'answer text, ' +
                    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,' +
                    'UNIQUE (entry_uuid, input_ref)' +
                    ')', [], (res) => {
                    }, _onError);

                // bookmarks table
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS bookmarks (' +
                    'id integer primary key, ' +
                    'project_ref text, ' +
                    'form_ref text, ' +
                    'parent_entry_uuid text, ' +
                    'title text, ' +
                    'bookmark text, ' +
                    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
                    ')', [], (res) => {
                    }, _onError);

                // settings table
                // NOTE: don't worry, 'value' is not a reserved word in sqlite
                tx.executeSql(
                    'CREATE TABLE IF NOT EXISTS settings (' +
                    'id integer primary key, ' +
                    'field text, ' +
                    'value text,' +
                    'UNIQUE (field)' +
                    ')', [], (res) => { }, _onError);

                //****************************************************************************************************
                // insert db version into settings table (only if it does not exists!!!!!!)
                const query = 'SELECT * FROM settings WHERE field=?';
                const params = [MIGRATIONS.dbVersionName];



                tx.executeSql(query, params, function (tx, res) {
                    if (res.rows.length === 0) {
                        tx.executeSql(
                            'INSERT INTO settings (' +
                            'field, ' +
                            'value' +
                            ') VALUES (?,?)', [MIGRATIONS.dbVersionName, MIGRATIONS.dbVersion], (res) => {
                            }, _onError);
                    }
                    else {
                        //this is not a first install, set a flag to localstorage
                        //this flag needs to be set each time the app starts
                        console.log('---App already installed -> skip db creation');
                        window.localStorage.is_app_already_installed = 1;
                    }
                }, _onError);
                //we need this to be able to migrate to a new db if needed
                //****************************************************************************************************
            }, _onError, () => {
                resolve();
            });
        });
    }
};


