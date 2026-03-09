import {Filesystem, Directory} from '@capacitor/filesystem';
import {utilsService} from '@/services/utilities/utils-service';
import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';

export const databaseExportService = {

    getPluginDbDirectory() {
        const rootStore = useRootStore();
        if (rootStore.device.platform === PARAMETERS.IOS) {
            const location = rootStore.iosDatabaseLocation || 'default';
            if (location === 'Documents') {
                return cordova.file.documentsDirectory;
            }
            // 'default' location uses Library/LocalDatabase/
            return cordova.file.applicationStorageDirectory + 'Library/LocalDatabase/';
        }
        // Android
        return cordova.file.applicationStorageDirectory + 'databases/';
    },

    openDatabase(dbName) {
        return new Promise((resolve, reject) => {
            const rootStore = useRootStore();
            const dbConfig = {name: dbName};

            // For iOS, use the stored iosDatabaseLocation
            if (rootStore.device.platform === PARAMETERS.IOS) {
                dbConfig.iosDatabaseLocation = rootStore.iosDatabaseLocation || 'default';
            } else {
                // For Android, use location: 'default'
                dbConfig.location = 'default';
            }

            const db = window.sqlitePlugin.openDatabase(
                dbConfig,
                () => resolve(db),
                (err) => reject(err)
            );
        });
    },

    closeDatabase(db) {
        return new Promise((resolve, reject) => {
            if (!db) {
                resolve();
                return;
            }
            db.close(resolve, reject);
        });
    },

    async copyDBFile(sourceDbName, copyDbName) {
        const dbDir = this.getPluginDbDirectory();

        await Filesystem.copy({
            from: dbDir + sourceDbName,
            to: dbDir + copyDbName
        });
    },

    async dropUnnecessaryTables(db) {
        const tablesToDrop = [
            'users', 'media',
            'unique_answers', 'temp_unique_answers',
            'bookmarks', 'settings'
        ];
        await new Promise((resolve, reject) => {
            db.transaction(
                (tx) => {
                    for (const table of tablesToDrop) {
                        tx.executeSql(`DROP TABLE IF EXISTS ${table}`);
                    }
                },
                reject, // error callback for the transaction
                resolve // success callback for the transaction
            );
        });
    },

    async moveToDocuments(copyDbName, exportPath) {
        const dbDir = this.getPluginDbDirectory();
        const copyPath = dbDir + copyDbName;

        const {data} = await Filesystem.readFile({path: copyPath});

        await Filesystem.writeFile({
            path: exportPath,
            data,
            directory: Directory.Documents,
            recursive: true
        });

        // Delete the copy from the plugin-managed location
        await Filesystem.deleteFile({path: copyPath});
    },

    async exportDatabase() {
        const copyDbName = PARAMETERS.DB_NAME.replace('.db', '_copy.db');
        let copyDb = null;

        try {
            // Step 1: Copy original DB to *_copy.db in the same plugin-managed location
            await this.copyDBFile(PARAMETERS.DB_NAME, copyDbName);

            // Step 2: Open the copy via sqlitePlugin and drop unnecessary tables
            copyDb = await this.openDatabase(copyDbName);
            await this.dropUnnecessaryTables(copyDb);
            await this.closeDatabase(copyDb);
            copyDb = null;

            // Step 3: Read cleaned copy and write to Documents, then delete the copy
            const exportPath = utilsService.getExportPath('/recovery/' + PARAMETERS.DB_NAME);
            await this.moveToDocuments(copyDbName, exportPath);
        } catch (error) {
            console.error('Error exporting database:', error);
            try {
                await Filesystem.deleteFile({path: this.getPluginDbDirectory() + copyDbName});
                // eslint-disable-next-line no-empty
            } catch (_) {
            }

            throw error;
        } finally {
            await this.closeDatabase(copyDb);
        }
    }
};
