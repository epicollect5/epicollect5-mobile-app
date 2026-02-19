import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

/**
 * 1. MANDATORY MOCKS (Hoisted)
 * These must be explicit to avoid Parse failures in Vite's SSR transform.
 */
vi.mock('@/router', () => ({
    default: {
        install: vi.fn(),
        isReady: vi.fn(() => Promise.resolve()),
    }
}));

vi.mock('pinia-logger', () => ({
    PiniaLogger: vi.fn(() => () => {})
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        PWA: 'web',
        PWA_ADD_ENTRY: 'add-entry',
        PWA_EDIT_ENTRY: 'edit-entry',
        DEFAULT_LANGUAGE: 'en',
        DEBUG: false,
        DELAY_EXTRA_LONG: 1,
        DEFAULT_SERVER_URL: '',
        PRODUCTION_SERVER_URL: 'https://prod.server.com'
    },
    STRINGS: {
        en: {
            labels: {
                unknown_error: 'Error',
                bookmarks_loading_error: 'Bookmark Error',
                temp_deletion_error: 'Temp Error'
            },
            status_codes: { ec5_103: '103' }
        }
        // Add other languages here if your tests use them
    }
}));

// Mocking Ionic specifically to handle global component registration
vi.mock('@ionic/vue', () => ({
    IonicVue: { install: vi.fn() },
    IonContent: { render: () => null },
    IonPage: { render: () => null }
    // Add any other specific Ion components used in main.js if needed
}));

// Stub UI and Assets individually to avoid "Parse failure" loop errors
vi.mock('@/App.vue', () => ({ default: { name: 'App', render: () => null } }));
vi.mock('@/components/globals/BaseLayout.vue', () => ({ default: {} }));
vi.mock('@/components/globals/LeftDrawer.vue', () => ({ default: {} }));
vi.mock('@/components/globals/RightDrawer.vue', () => ({ default: {} }));
vi.mock('@/components/ListAnswers.vue', () => ({ default: {} }));
vi.mock('@/components/ListItemAnswer.vue', () => ({ default: {} }));
vi.mock('@/theme/variables.css', () => ({}));
vi.mock('@/theme/core.scss', () => ({}));
vi.mock('@/theme/animate.min.css', () => ({}));
vi.mock('@/theme/question.scss', () => ({}));
vi.mock('@/theme/modal.scss', () => ({}));
vi.mock('@/theme/popover.scss', () => ({}));
vi.mock('@/theme/zoom.scss', () => ({}));
vi.mock('@ionic/vue/css/core.css', () => ({}));
vi.mock('@ionic/vue/css/normalize.css', () => ({}));
vi.mock('@ionic/vue/css/structure.css', () => ({}));
vi.mock('@ionic/vue/css/typography.css', () => ({}));


// 1. IMPROVED SERVICE MOCKS (Fixing the undefineds)
vi.mock('@/services/init-service', () => ({
    initService: {
        getDeviceInfo: vi.fn(),
        getLanguagePWA: vi.fn(),
        getAppInfo: vi.fn(() => Promise.resolve({ version: '1.0.0' })),
        getLanguage: vi.fn(),
        openDB: vi.fn(),
        getDBVersion: vi.fn(),
        migrateDB: vi.fn(() => Promise.resolve(2)), // Fixes 'Database version migrated to -> undefined'
        getServerUrl: vi.fn(() => Promise.resolve('https://api.test.com')), // Fixes Native 'Server URL -> undefined'
        tidyTempTables: vi.fn(),
        getEntriesOrder: vi.fn(() => Promise.resolve([])),
        insertDemoProject: vi.fn(),
        getSelectedTextSize: vi.fn(() => Promise.resolve('medium')),
        getCollectErrorsPreference: vi.fn(() => Promise.resolve(true)),
        retrieveJwtToken: vi.fn(() => Promise.resolve({ name: 'Test User' })),
    }
}));

vi.mock('@/services/web-service', () => ({ webService: { getProjectPWA: vi.fn() } }));
vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getBasepath: vi.fn(() => '/'),
        stripTrailingSlash: vi.fn((s) => s)
    }
}));
vi.mock('@/services/utilities/rollbar-service', () => ({ rollbarService: { init: vi.fn() } }));
vi.mock('@/services/notification-service', () => ({ notificationService: { showAlert: vi.fn() } }));
vi.mock('@/services/database/database-create-service', () => ({ createDatabaseService: { execute: vi.fn() } }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: vi.fn() } }));
vi.mock('@/services/utilities/bookmarks-service', () => ({ bookmarksService: { getBookmarks: vi.fn() } }));
vi.mock('@/services/filesystem/media-dirs-service', () => ({ mediaDirsService: { createDirsLegacy: vi.fn() } }));
vi.mock('@/services/filesystem/temp-dirs-service', () => ({
    tempDirsService: { createTemporaryDir: vi.fn(), clearTemporaryDir: vi.fn() }
}));
vi.mock('@/services/filesystem/persistent-dirs-service', () => ({ persistentDirsService: { execute: vi.fn() } }));
vi.mock('@/models/project-model.js', () => ({ projectModel: { initialisePWA: vi.fn() } }));
vi.mock('@/use/entry/setup-pwa-entry', () => ({ setupPWAEntry: vi.fn() }));

describe('Main.js Architecture', () => {

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        setActivePinia(createPinia());

        // 1. Fix: Mount Target
        document.body.innerHTML = '<div id="app"></div>';

        // 2. Fix: Ensure ENV variables are set BEFORE import
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('VUE_APP_PWA_DEVELOPMENT_SERVER', 'https://dev.server.com/');

        delete window.location;
        window.location = {
            pathname: '/',
            search: '',
            href: 'https://test.com/project-slug/add-entry',
            origin: 'https://test.com'
        };
    });

    const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

    it('boots as PWA when platform is web', async () => {
        const { initService } = await import('@/services/init-service');
        const { webService } = await import('@/services/web-service');
        const { setupPWAEntry } = await import('@/use/entry/setup-pwa-entry');

        initService.getDeviceInfo.mockResolvedValue({ platform: 'web' });
        webService.getProjectPWA.mockResolvedValue({ data: {} });
        setupPWAEntry.mockResolvedValue('form-ref-123');

        window.location.pathname = '/my-project/add-entry';

        await import('@/main');
        await flushPromises();

        const { useRootStore } = await import('@/stores/root-store');
        const rootStore = useRootStore();

        expect(rootStore.isPWA).toBe(true);
        expect(initService.getLanguagePWA).toHaveBeenCalled();
        expect(rootStore.providedSegment).toBe('add-entry');
    });

    it('boots as Native when platform is android', async () => {
        const { initService } = await import('@/services/init-service');
        const { bookmarksService } = await import('@/services/utilities/bookmarks-service');

        initService.getDeviceInfo.mockResolvedValue({ platform: 'android' });
        initService.openDB.mockResolvedValue({ executeSql: vi.fn() });
        initService.getAppInfo.mockResolvedValue({});
        initService.getLanguage.mockResolvedValue('en');
        initService.getDBVersion.mockResolvedValue(1);
        bookmarksService.getBookmarks.mockResolvedValue([]);

        await import('@/main');
        await flushPromises();

        const { useRootStore } = await import('@/stores/root-store');
        const rootStore = useRootStore();

        expect(rootStore.isPWA).toBe(false);
        expect(initService.openDB).toHaveBeenCalled();
        expect(initService.insertDemoProject).toHaveBeenCalled();
    });

    it('handles Branch entry logic when branch params are present', async () => {
        const { initService } = await import('@/services/init-service');
        const { webService } = await import('@/services/web-service');
        const { setupPWAEntry } = await import('@/use/entry/setup-pwa-entry');

        initService.getDeviceInfo.mockResolvedValue({ platform: 'web' });
        webService.getProjectPWA.mockResolvedValue({ data: {} });
        setupPWAEntry.mockResolvedValue('form-ref-branch');

        // 1. Simulate Branch URL Parameters
        window.location.pathname = '/my-project/add-entry';
        window.location.search = '?branch_ref=test_ref&branch_owner_uuid=12345';

        // Trigger IIFE
        await import('@/main');
        await flushPromises();

        const { useRootStore } = await import('@/stores/root-store');
        const rootStore = useRootStore();

        // 2. Verify it detected the branch
        expect(rootStore.routeParams.isBranch).toBe(true);
        expect(rootStore.routeParams.formRef).toBe('form-ref-branch');
        console.log('Branch Flow Verified: isBranch =', rootStore.routeParams.isBranch);
    });

    it('sets notFound if editing an entry without a UUID', async () => {
        const { initService } = await import('@/services/init-service');
        const { webService } = await import('@/services/web-service');

        initService.getDeviceInfo.mockResolvedValue({ platform: 'web' });
        webService.getProjectPWA.mockResolvedValue({ data: {} });

        // 1. Simulate Edit Entry WITHOUT the required uuid param
        window.location.pathname = '/my-project/edit-entry';
        window.location.search = '';

        await import('@/main');
        await flushPromises();

        const { useRootStore } = await import('@/stores/root-store');
        expect(useRootStore().notFound).toBe(true);
        console.log('UUID Validation Verified: notFound =', useRootStore().notFound);
    });
    it('PWA: triggers notFound for invalid UUIDs in edit-entry mode', async () => {
        const { initService } = await import('@/services/init-service');
        const { commonValidate } = await import('@/services/validation/common-validate');

        initService.getDeviceInfo.mockResolvedValue({ platform: 'web' });
        // Simulate invalid UUID check
        vi.spyOn(commonValidate, 'isValidUuid').mockReturnValue(false);

        window.location.pathname = '/project/edit-entry';
        window.location.search = '?uuid=bad-id';

        await import('@/main');
        await flushPromises();

        const { useRootStore } = await import('@/stores/root-store');
        expect(useRootStore().notFound).toBe(true);
    });

    it('Native: executes filesystem cleanup only on native platforms', async () => {
        const { initService } = await import('@/services/init-service');
        const { mediaDirsService } = await import('@/services/filesystem/media-dirs-service');
        const { Capacitor } = await import('@capacitor/core');

        // Setup: Platform AND Language
        initService.getDeviceInfo.mockResolvedValue({ platform: 'android' });
        initService.getLanguage.mockResolvedValue('en'); // This prevents the 'labels' undefined error
        initService.openDB.mockResolvedValue({ executeSql: vi.fn() });

        vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

        await import('@/main');
        await flushPromises();

        expect(mediaDirsService.createDirsLegacy).toHaveBeenCalled();
    });

    it('Native: switches to production server when DEBUG is false', async () => {
        const { PARAMETERS } = await import('@/config');
        const { initService } = await import('@/services/init-service');

        PARAMETERS.DEBUG = false;
        PARAMETERS.PRODUCTION_SERVER_URL = 'https://production.epicollect.net';
        initService.getDeviceInfo.mockResolvedValue({ platform: 'android' });

        // Setup: Platform AND Language
        initService.getLanguage.mockResolvedValue('en'); // This prevents the 'labels' undefined error

        await import('@/main');
        await flushPromises();

        expect(PARAMETERS.DEFAULT_SERVER_URL).toBe('https://production.epicollect.net');
    });
    it('PWA: covers the error catch block when project fetch fails', async () => {
        const { initService } = await import('@/services/init-service');
        const { webService } = await import('@/services/web-service');
        const { notificationService } = await import('@/services/notification-service');

        initService.getDeviceInfo.mockResolvedValue({ platform: 'web' });
        // Force the service to fail
        webService.getProjectPWA.mockRejectedValue({ statusText: 'Not Found', status: 404 });

        window.location.pathname = '/project/add-entry';

        await import('@/main');
        await flushPromises();

        expect(notificationService.showAlert).toHaveBeenCalledWith('Not Found', 404);
    });
    it('Native: covers native-only filesystem logic', async () => {
        const { initService } = await import('@/services/init-service');
        const { Capacitor } = await import('@capacitor/core');
        const { mediaDirsService } = await import('@/services/filesystem/media-dirs-service');

        initService.getDeviceInfo.mockResolvedValue({ platform: 'android' });
        initService.getLanguage.mockResolvedValue('en');
        // Force native platform to true
        vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

        await import('@/main');
        await flushPromises();

        expect(mediaDirsService.createDirsLegacy).toHaveBeenCalled();
    });
});
