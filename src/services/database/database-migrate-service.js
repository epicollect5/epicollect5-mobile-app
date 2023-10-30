/* eslint-disable  no-fallthrough */
import { useDBStore } from '@/stores/db-store';
import { MIGRATIONS } from '@/config';

export const databaseMigrateService = {

    async execute(dbVersion) {
        const dbStore = useDBStore();
        const db = dbStore.db;
        let currentDbVersion = dbVersion;

        return new Promise((resolve, reject) => {

            function _onError(tx, error) {
                console.log(tx, error);
                reject(error);
            }

            db.transaction((tx) => {
                // Version to upgrade from is the current version in the db + 1
                // IMP:All cases will get executed, fallthrough rules eslint is disabled
                // NOTE: parsing as Int because dbVersion is a string
                const versionToUpgradeFrom = parseInt(dbVersion, 10) + 1;

                // Switch to make 'current version' changes
                switch (versionToUpgradeFrom) {
                    case 2:
                        currentDbVersion = 2;
                        // ALTER TABLE add column form_ref to unique_answers
                        tx.executeSql(
                            'ALTER TABLE unique_answers ' +
                            'ADD COLUMN form_ref text',
                            [],
                            function (res) {
                                console.log('Migration to add column form_ref to unique_answers table');
                                console.log('Migration tx done, db at version ->', 2);
                            }, _onError);

                        // ALTER TABLE add column form_ref to temp_unique_answers
                        tx.executeSql(
                            'ALTER TABLE temp_unique_answers ' +
                            'ADD COLUMN form_ref text',
                            [],
                            function (res) {
                                console.log('Migration to add column form_ref to temp_unique_answers table');
                                console.log('Migration tx done, db at version ->', 2);
                            }, _onError);
                    case 3:
                        currentDbVersion = 3;
                        // ALTER TABLE add column user_name to users
                        tx.executeSql(
                            'ALTER TABLE users ' +
                            'ADD COLUMN name text',
                            [],
                            function (res) {
                                console.log('Migration to add column name to users table');
                                console.log('Migration tx done, db at version ->', 3);
                            }, _onError);
                    case 4:
                        currentDbVersion = 4;
                        // ALTER TABLE add column user_name to users
                        tx.executeSql(
                            'ALTER TABLE users ' +
                            'ADD COLUMN email text',
                            [],
                            function (res) {
                                console.log('Migration to add column email to users table');
                                console.log('Migration tx done, db at version ->', 4);
                            }, _onError);
                    case 5:
                        currentDbVersion = 5;
                        // ALTER TABLE add column mapping to projects
                        tx.executeSql(
                            'ALTER TABLE projects ' +
                            'ADD COLUMN mapping text',
                            [],
                            function (res) {
                                console.log('Migration to add column mapping to projects table');
                                console.log('Migration tx done, db at version ->', 5);
                            }, _onError);
                    // More cases to be added here for next versions, omitting 'break'
                }
            }, _onError, (res) => {
                db.transaction((tx) => {
                    // Finally, insert or replace into settings the latest version
                    tx.executeSql(
                        'INSERT OR REPLACE INTO settings (' +
                        'field, ' +
                        'value' +
                        ') VALUES (?,?)', [MIGRATIONS.dbVersionName, currentDbVersion], () => {
                            console.log('Migration complete');
                            console.log('Database version ->', currentDbVersion);
                            resolve(currentDbVersion);
                        }, _onError);
                });
            });
        });
    }
};