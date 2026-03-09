import {vi, describe, it, expect, beforeEach, afterEach} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import {Filesystem} from '@capacitor/filesystem';
import {useRootStore} from '@/stores/root-store';

// 1. Mock Capacitor Filesystem
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        stat: vi.fn(),
        mkdir: vi.fn(),
        copy: vi.fn(),
        deleteFile: vi.fn()
    },
    Directory: {
        Documents: 'DOCUMENTS',
        Library: 'LIBRARY'
    }
}));

// 2. Mock Config
vi.mock('@/config', () => ({
    PARAMETERS: {
        DB_NAME: 'epicollect.db',
        ANDROID: 'android',
        IOS: 'ios',
        WEB: 'web',
        DELAY_LONG: 10
    }
}));

describe('Init Service', () => {
    let initService;

    beforeEach(async () => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        vi.useFakeTimers(); // Needed for setTimeout in openDB

        // Mock the global sqlitePlugin object
        window.sqlitePlugin = {
            openDatabase: vi.fn()
        };

        // Dynamic import to ensure it uses the mocks
        const module = await import('@/services/init-service');
        initService = module.initService;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('migrateLegacyDatabase()', () => {
        it('returns true if no legacy database is found', async () => {
            Filesystem.stat.mockRejectedValue(new Error('Not found'));

            const result = await initService.migrateLegacyDatabase();
            expect(result).toBe(true);
            expect(Filesystem.copy).not.toHaveBeenCalled();
        });

        it('migrates and deletes legacy DB if integrity is OK', async () => {
            // Mock legacy exists
            Filesystem.stat.mockResolvedValueOnce({});
            // Mock target folder check fails (needs creation)
            Filesystem.stat.mockRejectedValueOnce(new Error('No dir'));
            Filesystem.mkdir.mockResolvedValue({});
            Filesystem.copy.mockResolvedValue({});

            // Mock verifyDatabaseIntegrity - we spy on the service method
            const integritySpy = vi.spyOn(initService, 'verifyDatabaseIntegrity').mockResolvedValue(true);

            const result = await initService.migrateLegacyDatabase();

            expect(result).toBe(true);
            expect(Filesystem.copy).toHaveBeenCalled();
            expect(Filesystem.deleteFile).toHaveBeenCalledWith(expect.objectContaining({
                directory: 'DOCUMENTS'
            }));
            integritySpy.mockRestore();
        });
    });

    describe('initDatabaseIOS()', () => {
        it('stores default iosDatabaseLocation in root store when migration succeeds', async () => {
            const mockDb = {id: 'ios-db'};
            window.sqlitePlugin.openDatabase.mockImplementation((config, success) => {
                // Defer so the service's 'db' variable is assigned before success fires
                Promise.resolve().then(() => success());
                return mockDb;
            });

            // Mock successful migration
            vi.spyOn(initService, 'migrateLegacyDatabase').mockResolvedValue(true);

            const rootStore = useRootStore();
            const db = await initService.initDatabaseIOS();

            expect(db.id).toBe('ios-db');
            expect(rootStore.iosDatabaseLocation).toBe('default');
        });

        it('stores Documents iosDatabaseLocation in root store when migration fails', async () => {
            const mockDb = {id: 'ios-db'};
            window.sqlitePlugin.openDatabase.mockImplementation((config, success) => {
                // Defer so the service's 'db' variable is assigned before success fires
                Promise.resolve().then(() => success());
                return mockDb;
            });

            // Mock failed migration
            vi.spyOn(initService, 'migrateLegacyDatabase').mockResolvedValue(false);

            const rootStore = useRootStore();
            const db = await initService.initDatabaseIOS();

            expect(db.id).toBe('ios-db');
            expect(rootStore.iosDatabaseLocation).toBe('Documents');
        });
    });

    describe('openDB()', () => {
        it('opens WebSQL on web platform', async () => {
            window.openDatabase = vi.fn().mockReturnValue({id: 'web-db'});

            const result = await initService.openDB('web');
            expect(result.id).toBe('web-db');
        });

        it('waits for deviceready and opens Android SQLite', async () => {
            const mockDb = {id: 'android-db'};
            window.sqlitePlugin.openDatabase.mockReturnValue(mockDb);

            const promise = initService.openDB('android');

            // Trigger the deviceready event manually
            document.dispatchEvent(new Event('deviceready'));

            // Fast-forward the setTimeout
            vi.advanceTimersByTime(10);

            const db = await promise;
            expect(db.id).toBe('android-db');
            expect(window.sqlitePlugin.openDatabase).toHaveBeenCalledWith(expect.objectContaining({
                androidDatabaseProvider: 'system'
            }));
        });
    });

    describe('verifyDatabaseIntegrity()', () => {
        it('resolves true when PRAGMA returns ok', async () => {
            const mockTx = {
                executeSql: vi.fn((query, params, success) => {
                    // Simulate the SQL result object
                    success(mockTx, {
                        rows: {
                            item: () => ({integrity_check: 'ok'})
                        }
                    });
                })
            };

            const mockDb = {
                transaction: vi.fn((cb, error, success) => {
                    cb(mockTx); // Run transaction
                    success();  // Trigger transaction success callback
                }),
                close: vi.fn((success) => success())
            };

            window.sqlitePlugin.openDatabase.mockReturnValue(mockDb);

            const result = await initService.verifyDatabaseIntegrity('test.db');
            expect(result).toBe(true);
            expect(mockDb.close).toHaveBeenCalled();
        });
    });
});
