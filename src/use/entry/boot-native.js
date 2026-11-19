import {STRINGS} from '@/config/strings';
import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';
import {useDBStore} from '@/stores/db-store';
import {useBookmarkStore} from '@/stores/bookmark-store';
import {Capacitor} from '@capacitor/core';
import {initService} from '@/services/init-service';
import {utilsService} from '@/services/utilities/utils-service';
import {bookmarksService} from '@/services/utilities/bookmarks-service';
import {themeService} from '@/services/theme-service';
import {mediaDirsService} from '@/services/filesystem/media-dirs-service';
import {tempDirsService} from '@/services/filesystem/temp-dirs-service';
import {persistentDirsService} from '@/services/filesystem/persistent-dirs-service';
import {createDatabaseService} from '@/services/database/database-create-service';
import {notificationService} from '@/services/notification-service';
import {rollbarService} from '@/services/utilities/rollbar-service';

//native boot: device language, database lifecycle, media directories,
//preferences. A database open failure is the one path that still aborts
//the boot in main.js (return false): the app is unusable without a db
export async function bootNative() {
    const rootStore = useRootStore();
    const dbStore = useDBStore();
    const bookmarkStore = useBookmarkStore();
    //make appInfo global
    rootStore.app = await initService.getAppInfo();
    //get device language
    rootStore.language = await initService.getLanguage();
    console.log('Device language -> ', rootStore.language);
    const labels = STRINGS[rootStore.language].labels;

    //Validate language files at startup for consistency when debugging
    if (PARAMETERS.DEBUG) {
        await utilsService.validateLanguageFiles();
    }

    //in production, make sure we use the production server
    if (!PARAMETERS.DEBUG) {
        //set the default url to production when not debugging
        PARAMETERS.DEFAULT_SERVER_URL = PARAMETERS.PRODUCTION_SERVER_URL;
    }

    //open db
    let db = {};
    //a boot failure reported before the collectErrors preference is read:
    //held here and submitted (or dropped) as soon as it is known
    const heldBootReports = [];
    try {
        db = await initService.openDB(rootStore.device.platform);
    } catch (error) {
        console.log(error);
        heldBootReports.push(['boot: openDB failed', error]);
        await notificationService.showAlert(error, STRINGS[rootStore.language].labels.unknown_error);
        //the preference lives in the DB that just failed to open, so it cannot
        //be honoured here: the failure stays in the console rather than risk
        //reporting for a user who opted out
        return false;
    }
    //create db tables if needed
    await createDatabaseService.execute(db);
    //make db available globally
    dbStore.db = db;
    dbStore.dbVersion = await initService.getDBVersion();
    console.log('Database version ->  ', dbStore.dbVersion);

    //do migrations if needed
    try {
        dbStore.dbVersion = await initService.migrateDB();
        console.log('Database version migrated to ->  ', dbStore.dbVersion);
    } catch (error) {
        console.log(error);
        heldBootReports.push(['boot: migrateDB failed', error]);
        await notificationService.showAlert(JSON.stringify(error));
    }

    //create media dirs (only on devices)
    if (Capacitor.isNativePlatform()) {
        //imp: use createDirsLegacy() to match the legacy directories
        //imp: capacitor !== cordova filesystem, would break old apps updates
        //cordova -> https://github.com/apache/cordova-plugin-file
        //capacitor -> https://capacitorjs.com/docs/apis/filesystem#directory

        await mediaDirsService.createDirsLegacy();

        //get temp dirs path
        rootStore.tempDir = await tempDirsService.createTemporaryDir();
        console.log('Device temp directory ->  ', rootStore.tempDir);

        //get persistent dirs path
        rootStore.persistentDir = await persistentDirsService.execute();
        console.log('Device persistent directory ->  ', rootStore.persistentDir);

        //clear the temp folder at startup, just in case there are some leftovers
        try {
            await tempDirsService.clearTemporaryDir();
        } catch (error) {
            await notificationService.showAlert(
                STRINGS[rootStore.language].labels.temp_deletion_error,
                STRINGS[rootStore.language].status_codes.ec5_103
            );
        }
    }

    //set server URL
    rootStore.serverUrl = await initService.getServerUrl();
    console.log('Server URL -> ', rootStore.serverUrl);

    //set bookmarks in a pinia store
    try {
        const bookmarks = await bookmarksService.getBookmarks();
        bookmarkStore.setBookmarks(bookmarks);
    } catch (error) {
        await notificationService.showAlert(labels.bookmarks_loading_error);
        bookmarkStore.setBookmarks([]);
    }

    //clear temporary tables
    await initService.tidyTempTables();

    //get the user preferred entries order
    const dbEntriesOrder = await initService.getEntriesOrder();
    if (dbEntriesOrder !== null) {
        dbStore.dbEntriesOrder = dbEntriesOrder;
    }

    //insert demo project to DB
    await initService.insertDemoProject();

    //text size preferences
    rootStore.selectedTextSize = await initService.getSelectedTextSize();

    //collect errors preferences
    rootStore.collectErrors = await initService.getCollectErrorsPreference();
    //the preference is finally known: apply it, then flush the boot failures
    //held above. An opt-out drops them; an opt-in still gets them reported,
    //just at this point rather than the moment they happened
    rollbarService.configure({ enabled: rootStore.collectErrors });
    heldBootReports.forEach(([reportContext, reportError]) => {
        if (rootStore.collectErrors) {
            rollbarService.criticalWithContext(reportContext, reportError);
        }
    });
    heldBootReports.length = 0;

    //in-app camera preferences (opt-in, default false): a rejected read must
    //not block boot, jwt retrieval, or app mount. false here is a deliberate
    //default-only fallback (not a persisted change): the saved setting is
    //untouched, so the next boot re-reads it and an opt-in user is only
    //affected for this session
    try {
        rootStore.inAppCamera = await initService.getInAppCameraPreference();
    } catch (error) {
        console.log('Failed to load in-app camera preference: ' + error);
        rootStore.inAppCamera = false;
    }
    try {
        rootStore.inAppCameraVideo = await initService.getInAppCameraVideoPreference();
    } catch (error) {
        console.log('Failed to load in-app camera video preference: ' + error);
        rootStore.inAppCameraVideo = false;
    }

    //keep-screen-on preference (opt-in, default false): a rejected read must not
    //block boot, so fall back to false for this session only
    try {
        rootStore.keepScreenOnDuringTransfer = await initService.getKeepScreenOnDuringTransferPreference();
    } catch (error) {
        console.log('Failed to load keep screen on preference: ' + error);
        rootStore.keepScreenOnDuringTransfer = false;
    }

    //theme preference (light/dark/system): a rejected read must not block
    //boot, so fall back to the default ('light') for this session only
    try {
        rootStore.theme = await initService.getThemePreference();
    } catch (error) {
        console.log('Failed to load theme preference: ' + error);
        rootStore.theme = PARAMETERS.DEFAULT_THEME;
    }
    themeService.applyTheme(rootStore.theme);

    // Attempt to retrieve the jwt token
    rootStore.user = await initService.retrieveJwtToken();
}
