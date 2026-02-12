import {Device} from '@capacitor/device';
import {App} from '@capacitor/app';
import {databaseSelectService} from '@/services/database/database-select-service';
import {databaseMigrateService} from '@/services/database/database-migrate-service';
import {databaseDeleteService} from '@/services/database/database-delete-service';
import {databaseInsertService} from '@/services/database/database-insert-service';
import {useRootStore} from '@/stores/root-store';
import {useDBStore} from '@/stores/db-store';
import {PARAMETERS, MIGRATIONS, DEMO_PROJECT} from '@/config';
import {STRINGS} from '@/config/strings';
import axios from 'axios';
import {Filesystem, Directory} from '@capacitor/filesystem';

export const initService = {

    async getDeviceInfo() {
        const deviceInfo = await Device.getInfo();
        const deviceId = await Device.getId();

        //switch to PWA mode based on environment
        if (deviceInfo.platform === PARAMETERS.WEB) {
            if (process.env.VUE_APP_MODE.toLowerCase() === PARAMETERS.PWA.toLowerCase()) {
                deviceInfo.platform = PARAMETERS.PWA;
            }
        }

        return {...deviceInfo, ...deviceId};
    },

    async getAppInfo() {
        const rootStore = useRootStore();
        if ([PARAMETERS.WEB, PARAMETERS.PWA].includes(rootStore.device.platform)) {
            return {
                name: 'Epicollect5',
                version: 'n/a'
            };
        }
        return await App.getInfo();
    },

    async initDatabaseIOS() {
        let dbLocation = 'default';
        const dbName = PARAMETERS.DB_NAME;

        // 1. Wait for migration
        const isPrivateReady = await this.migrateLegacyDatabase();

        if (!isPrivateReady) {
            console.warn('Migration failed. Falling back to Documents.');
            dbLocation = 'Documents';
        }

        // 2. Wrap the Callback-based openDatabase in a Promise
        return new Promise((resolve, reject) => {
            const db = window.sqlitePlugin.openDatabase({
                name: dbName,
                iosDatabaseLocation: dbLocation
            }, () => {
                console.log(`Database opened successfully at: ${dbLocation}`);
                // Resolve the promise with the db instance
                resolve(db);
            }, (err) => {
                console.error('Critical database open error:', err);
                reject(err);
            });
        });
    },

    async openDB(platform) {
        const dbName = PARAMETERS.DB_NAME;
        return new Promise((resolve, reject) => {
            let db = {};

            if (platform === PARAMETERS.WEB) {
                db = window.openDatabase(dbName, '1.0', 'epicollect5', 5000000);
                resolve(db);
            } else {
                document.addEventListener('deviceready', () => {
                    console.log('deviceready called');

                    if (platform === PARAMETERS.ANDROID) {
                        db = window.sqlitePlugin.openDatabase({
                            name: dbName,
                            location: 'default',
                            androidDatabaseProvider: 'system',
                            androidLockWorkaround: 1//to be tested if this makes problems
                        });
                        console.log('Database opened correctly, using default location');
                        setTimeout(() => {
                            resolve(db);
                        }, PARAMETERS.DELAY_LONG);
                    }

                    if (platform === PARAMETERS.IOS) {
                        this.initDatabaseIOS().then((db)=> {
                            setTimeout(() => {
                                resolve(db);
                            }, PARAMETERS.DELAY_LONG);
                        }, (error) => {
                            reject(error);
                        });
                    }
                });
            }
        });
    },

    /**
     * Moves DB from Documents to Library/LocalDatabase with Integrity Verification
     */
    async migrateLegacyDatabase() {
        const dbName = 'epicollect5.db';
        const targetFolder = 'LocalDatabase';

        try {
            // A. Check for legacy file existence explicitly
            let isLegacyPresent = false;
            try {
                await Filesystem.stat({path: dbName, directory: Directory.Documents});
                isLegacyPresent = true;
            } catch (e) {
                isLegacyPresent = false;
            }

            // B. Skip logic: If it's not in Documents, we are already private or fresh.
            if (!isLegacyPresent) {
                return true;
            }

            // C. Prepare the private directory
            try {
                await Filesystem.stat({path: targetFolder, directory: Directory.Library});
            } catch (e) {
                await Filesystem.mkdir({path: targetFolder, directory: Directory.Library, recursive: true});
            }

            // D. Perform the move (Copy first for safety)
            await Filesystem.copy({
                from: dbName, directory: Directory.Documents,
                to: `${targetFolder}/${dbName}`, toDirectory: Directory.Library
            });

            // E. Verify the health of the new copy
            const isHealthy = await this.verifyDatabaseIntegrity(dbName);

            if (isHealthy) {
                // F. Success! Wipe the public evidence.
                await Filesystem.deleteFile({path: dbName, directory: Directory.Documents});
                return true;
            } else {
                // Failure: Delete the corrupted copy so we don't use it.
                await Filesystem.deleteFile({path: `${targetFolder}/${dbName}`, directory: Directory.Library});
                return false;
            }

        } catch (error) {
            console.error('Migration Logic Failure:', error);
            return false;
        }
    },

    /**
     * Runs a PRAGMA integrity_check to ensure the moved file is valid.
     */
    async verifyDatabaseIntegrity(name) {
        return new Promise((resolve) => {
            try {
                const db = window.sqlitePlugin.openDatabase({
                    name: name,
                    iosDatabaseLocation: 'default'
                });

                // Use a simple executeSql if your plugin version supports it,
                // otherwise keep the transaction but wait for the SUCCESS callback.
                db.transaction((tx) => {
                    tx.executeSql('PRAGMA integrity_check;', [], (tx, results) => {
                        const status = results.rows.item(0).integrity_check;
                        console.log('Verification status:', status);

                        if (status === 'ok') {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    }, (tx, err) => {
                        console.error('SQL Error during integrity check', err);
                        resolve(false);
                    });
                }, (err) => {
                    console.error('Transaction Error', err);
                    resolve(false);
                }, () => {
                    // SUCCESS CALLBACK: The transaction is fully finished and committed here.
                    // It is now safe to close the DB without the "transaction in progress" error.
                    db.close(() => console.log('Temp DB closed safely.'), (e) => {
                    });
                });
            } catch (e) {
                resolve(false);
            }
        });
    },

    async getDBVersion() {

        let version;

        return new Promise((resolve, reject) => {
            databaseSelectService.selectSetting('db_version').then((res) => {

                if (res.rows.length > 0) {
                    version = res.rows.item(0).value;
                }
                resolve(version);
            }, (error) => {
                reject(error);
            });
        });
    },

    async migrateDB() {
        /**
         * Migrating altering tables, depending on stored version against latest version
         * See: http://stackoverflow.com/questions/989558/best-practices-for-in-app-database-migration-for-sqlite
         */
            // Get the db version from the database
        const dbStore = useDBStore();
        let dbVersion = dbStore.dbVersion;
        // Check if it doesn't exist
        if (!dbVersion) {
            // Set version as initial, to run through all alter table cases
            dbVersion = 1;
        } else if (dbVersion >= MIGRATIONS.db_version) {
            // Check if the version is not lower than the current version
            // todo: not sure what this does?
            // return $q.when([]);
        }

        // Alter the table if either there is no version set, or if the version is lower than the latest
        return new Promise((resolve, reject) => {
            databaseMigrateService.execute(dbVersion).then((nextVersion) => {
                // Warn user
                //NotificationService.showToast(STRINGS[$rootStore.language].labels.db_updated);
                // console.log(STRINGS[$rootStore.language].labels.db_updated);
                resolve(nextVersion);
            }, (error) => {
                reject(error);
            });
        });
    },

    async getLanguage() {
        const self = this;
        let deviceLanguage = PARAMETERS.DEFAULT_LANGUAGE; //en

        return new Promise((resolve, reject) => {
            if (navigator.globalization) {
                navigator.globalization.getPreferredLanguage(
                    function (language) {
                        //if the language translation exists, load it:

                        //Italian?
                        if (language.value.toLowerCase().startsWith('it')) {
                            deviceLanguage = 'it';
                        }
                        //Spanish?
                        if (language.value.toLowerCase().startsWith('es')) {
                            deviceLanguage = 'es';
                        }

                        //Catalan?
                        if (language.value.toLowerCase().startsWith('ca')) {
                            deviceLanguage = 'ca';
                        }

                        //French?
                        if (language.value.toLowerCase().startsWith('fr')) {
                            deviceLanguage = 'fr';
                        }

                        //Polish?
                        if (language.value.toLowerCase().startsWith('pl')) {
                            deviceLanguage = 'pl';
                        }

                        //Portuguese?
                        if (language.value.toLowerCase().startsWith('pt')) {
                            deviceLanguage = 'pt';
                        }

                        //Slovenian?
                        if (language.value.toLowerCase().startsWith('sl')) {
                            deviceLanguage = 'sl';
                        }

                        //German?
                        if (language.value.toLowerCase().startsWith('de')) {
                            deviceLanguage = 'de';
                        }

                        //if language not supported, default to English
                        self.getLanguageFile(deviceLanguage).then((data) => {
                            STRINGS[deviceLanguage].status_codes = data;
                            resolve(deviceLanguage);
                        }, (data) => {
                            STRINGS[PARAMETERS.DEFAULT_LANGUAGE].status_codes = data;
                            resolve(PARAMETERS.DEFAULT_LANGUAGE);
                        });

                        console.log('language: ' + language.value + '\n');
                    }, () => {
                        console.log('Error getting language');
                    }
                );
            } else {
                self.getLanguageFile(PARAMETERS.DEFAULT_LANGUAGE).then((data) => {
                    STRINGS[PARAMETERS.DEFAULT_LANGUAGE].status_codes = data;
                    resolve(PARAMETERS.DEFAULT_LANGUAGE);
                });
            }
        });
    },

    getLanguageFile(language) {
        return new Promise((resolve, reject) => {
            //get status codes files (json) from public folder
            axios('./assets/ec5-status-codes/' + language + '.json')
                .then((languageFileData) => {
                    resolve(languageFileData.data);
                }, () => {
                    // Default to 'en' file
                    axios('./assets/ec5-status-codes/en.json').then((defaultLanguageFileData) => {
                        reject(defaultLanguageFileData.data);
                    });
                });
        });
    },

    async getLanguagePWA() {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const serverUrl = rootStore.serverUrl;
        let url = '/';

        return new Promise((resolve, reject) => {
            if (process.env.NODE_ENV === 'production') {
                //get the language files from data-editor folder in laravel
                const endpoint = PARAMETERS.PWA_LANGUAGE_FILES_ENDPOINT;
                url = serverUrl + endpoint + language + '.json';
            } else {
                //development i.e debugging pwa in the browser
                //get language file from local assets
                url = './assets/ec5-status-codes/' + language + '.json';
            }

            axios(url)
                .then((data) => {
                    STRINGS[language].status_codes = data.data;
                    resolve(language);
                }).catch((error) => {
                console.log(error);
            });
        });
    },

    //Get the server url from the database, or default to ec5 production site
    async getServerUrl() {
        return new Promise((resolve, reject) => {
            databaseSelectService.selectSetting('server_url').then(function (res) {
                if (res.rows.length > 0 && res.rows.item(0).value !== '') {
                    resolve(res.rows.item(0).value);
                } else {
                    resolve(PARAMETERS.DEFAULT_SERVER_URL);
                }
                resolve();
            }, function (error) {
                reject(error);
            });
        });
    },

    //clear temporary tables
    async tidyTempTables() {

        return new Promise((resolve, reject) => {
            databaseDeleteService.deleteTempBranchEntries().then(() => {
                databaseDeleteService.deleteTempUniqueAnswers().then(() => {
                    resolve();
                }, (error) => {
                    reject(error);
                });
            }, (error) => {
                reject(error);
            });
        });
    },

    //Get the default order for displaying entries
    async getEntriesOrder() {

        return new Promise((resolve, reject) => {

            databaseSelectService.selectSetting('order_by').then(function (res) {

                // Update rootscope
                if (res.rows.length > 0) {
                    resolve(JSON.parse(res.rows.item(0).value));
                } else {
                    resolve(null);
                }
            }, function (error) {
                reject(error);
            });
        });
    },

    // Insert ec5 demo project
    async insertDemoProject() {

        function _getDemoProjectFromLocalFile(filename) {
            return new Promise((resolve) => {
                axios(filename)
                    .then((data) => {
                        resolve(JSON.stringify(data));
                    });
            });
        }

        return new Promise((resolve, reject) => {

            //insert the demo project only on first install
            if (!window.localStorage.is_app_already_installed) {

                _getDemoProjectFromLocalFile(DEMO_PROJECT.PROJECT_FILENAME).then((response) => {

                    //just the "data" content, not the whole response
                    const meta = JSON.parse(response).data.meta;
                    DEMO_PROJECT.PROJECT_EXTRA = JSON.stringify(meta.project_extra);
                    DEMO_PROJECT.MAPPING = JSON.stringify(meta.project_mapping);


                    databaseInsertService.insertProject(
                        DEMO_PROJECT.PROJECT_SLUG,
                        DEMO_PROJECT.PROJECT_NAME,
                        DEMO_PROJECT.PROJECT_REF,
                        DEMO_PROJECT.PROJECT_EXTRA,
                        PARAMETERS.DEFAULT_SERVER_URL,
                        DEMO_PROJECT.LAST_UPDATED,
                        DEMO_PROJECT.MAPPING
                    ).then((res) => {
                        resolve();
                    }, (error) => {
                        reject(error);
                    });
                });
            } else {
                console.log('---App already installed -> skip demo project creation');
                resolve();
            }
        });
    },

    //Get the selected text size from database
    async getSelectedTextSize() {

        let selectedTextSize = PARAMETERS.DEFAULT_TEXT_SIZE;

        return new Promise((resolve, reject) => {
            databaseSelectService.selectSetting('selected_text_size').then(function (res) {

                if (res.rows.length > 0 && res.rows.item(0).value !== '0') {
                    selectedTextSize = res.rows.item(0).value;
                }
                resolve(selectedTextSize);
            }, function (error) {
                reject(error);
            });
        });
    },

    //Get the collect errors flag
    async getCollectErrorsPreference() {
        return new Promise((resolve, reject) => {
            databaseSelectService.selectSetting(PARAMETERS.SETTINGS_KEYS.COLLECT_ERRORS).then(function (res) {

                //if not found, the user has left the default
                if (res.rows.length === 0) {
                    resolve(true);
                    return;
                }

                //if we have a row, user made changes, check status
                resolve(res.rows.item(0).value === 'true' ? true : false);
            }, function (error) {
                reject(error);
            });
        });
    },

    async retrieveJwtToken() {
        const rootStore = useRootStore();
        return new Promise(function (resolve, reject) {
            databaseSelectService.getUser().then(async function (response) {

                const user = {};
                // Get the db version from the database
                const language = rootStore.language;

                // Set JWT into rootscope
                user.jwt = '';
                user.name = '';
                user.email = '';

                // Check if we have one
                if (response.rows.length > 0) {
                    // If we do, then the action is to 'logout'
                    user.action = STRINGS[language].labels.logout;
                    // Set JWT into rootscope
                    user.jwt = response.rows.item(0).jwt;
                    // Set User name into rootscope

                    user.name = response.rows.item(0).name;
                    user.email = response.rows.item(0).email;

                } else {
                    // Default action to 'login'
                    user.action = STRINGS[language].labels.login;
                }

                resolve(user);
            });
        });
    }
};
