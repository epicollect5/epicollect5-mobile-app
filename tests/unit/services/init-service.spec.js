import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { Filesystem } from '@capacitor/filesystem';

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
        DELAY_LONG: 10,
        SETTINGS_KEYS: {
            IN_APP_CAMERA: 'in_app_camera',
            IN_APP_CAMERA_VIDEO: 'in_app_camera_video',
            COLLECT_ERRORS: 'collect_errors',
            KEEP_SCREEN_ON_DURING_TRANSFER: 'keep_screen_on_during_transfer',
            THEME: 'theme'
        },
        DEFAULT_THEME: 'light',
        THEMES: {
            LIGHT: 'light',
            DARK: 'dark',
            SYSTEM: 'system'
        }
    }
}));

const selectSettingMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        selectSetting: selectSettingMock
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
            Filesystem.stat.mockResolvedValueOnce({});
            Filesystem.stat.mockRejectedValueOnce(new Error('No dir'));
            Filesystem.mkdir.mockResolvedValue({});
            Filesystem.copy.mockResolvedValue({});

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

    describe('openDB()', () => {
        it('opens WebSQL on web platform', async () => {
            window.openDatabase = vi.fn().mockReturnValue({ id: 'web-db' });

            const result = await initService.openDB('web');
            expect(result.id).toBe('web-db');
        });

        it('waits for deviceready and opens Android SQLite', async () => {
            const mockDb = { id: 'android-db' };
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

    describe('verifyDatabaseIntegrity()', () => {        it('resolves true when PRAGMA returns ok', async () => {
            const mockTx = {
                executeSql: vi.fn((query, params, success) => {
                    success(mockTx, {
                        rows: { item: () => ({ integrity_check: 'ok' }) }
                    });
                })
            };

            const mockDb = {
                transaction: vi.fn((cb, error, success) => {
                    cb(mockTx);
                    success();
                }),
                close: vi.fn((success) => success())
            };

            window.sqlitePlugin.openDatabase.mockReturnValue(mockDb);

            const result = await initService.verifyDatabaseIntegrity('test.db');

            expect(result).toBe(true);
            expect(mockDb.close).toHaveBeenCalled();
        });

        it('resolves false when PRAGMA returns anything other than ok', async () => {
            const mockTx = {
                executeSql: vi.fn((query, params, success) => {
                    success(mockTx, {
                        rows: { item: () => ({ integrity_check: 'corrupt' }) }
                    });
                })
            };

            const mockDb = {
                transaction: vi.fn((cb, error, success) => {
                    cb(mockTx);
                    success();
                }),
                close: vi.fn((success) => success())
            };

            window.sqlitePlugin.openDatabase.mockReturnValue(mockDb);

            const result = await initService.verifyDatabaseIntegrity('test.db');

            expect(result).toBe(false);
        });

        it('resolves false when SQL execution fails', async () => {
            const mockTx = {
                executeSql: vi.fn((query, params, success, error) => {
                    error(mockTx, new Error('SQL error'));
                })
            };

            const mockDb = {
                transaction: vi.fn((cb, _error) => {
                    cb(mockTx);
                }),
                close: vi.fn((success) => success())
            };

            window.sqlitePlugin.openDatabase.mockReturnValue(mockDb);

            const result = await initService.verifyDatabaseIntegrity('test.db');

            expect(result).toBe(false);
        });
    });

    describe('resolveWhenDbReady()', () => {
        it('resolves as soon as the probe query succeeds', async () => {
            const mockDb = { id: 'ready-db' };
            mockDb.transaction = vi.fn((cb) => {
                cb({ executeSql: vi.fn((query, params, success) => success()) });
            });

            const result = await initService.resolveWhenDbReady(mockDb);

            expect(result.id).toBe('ready-db');
            expect(mockDb.transaction).toHaveBeenCalled();
        });

        it('falls back to the timeout cap when the probe query fails', async () => {
            const mockDb = {
                id: 'slow-db',
                transaction: vi.fn((cb) => {
                    cb({ executeSql: vi.fn((query, params, success, error) => error()) });
                })
            };

            const promise = initService.resolveWhenDbReady(mockDb);
            let resolved = false;
            promise.then(() => {
                resolved = true;
            });

            //a failed probe must not resolve early...
            vi.advanceTimersByTime(9);
            expect(resolved).toBe(false);

            //...it resolves at the cap
            vi.advanceTimersByTime(1);
            const result = await promise;

            expect(resolved).toBe(true);
            expect(result.id).toBe('slow-db');
        });

        it('waits the full cap when the probe never answers', async () => {
            const mockDb = {
                id: 'silent-db',
                transaction: vi.fn(() => {
                    //neither success nor error: the silent-handle case the cap protects
                })
            };

            const promise = initService.resolveWhenDbReady(mockDb);
            let resolved = false;
            promise.then(() => {
                resolved = true;
            });

            //must stay pending before the cap...
            vi.advanceTimersByTime(9);
            expect(resolved).toBe(false);

            //...then resolve at the limit
            vi.advanceTimersByTime(1);
            const result = await promise;

            expect(resolved).toBe(true);
            expect(result.id).toBe('silent-db');
        });

        it('falls back to the timeout cap when transaction throws synchronously', async () => {
            const mockDb = { id: 'throwing-db' };

            const promise = initService.resolveWhenDbReady(mockDb);
            vi.advanceTimersByTime(10);
            const result = await promise;

            expect(result.id).toBe('throwing-db');
        });
    });

    describe('getInAppCameraPreference()', () => {
        it('resolves false when the settings row is absent', async () => {
            selectSettingMock.mockResolvedValue({ rows: { length: 0 } });

            const result = await initService.getInAppCameraPreference();

            expect(result).toBe(false);
            expect(selectSettingMock).toHaveBeenCalledWith('in_app_camera');
        });

        it('resolves true when the stored value is "true"', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'true' }) }
            });

            const result = await initService.getInAppCameraPreference();

            expect(result).toBe(true);
        });

        it('resolves false when the stored value is "false"', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'false' }) }
            });

            const result = await initService.getInAppCameraPreference();

            expect(result).toBe(false);
        });
    });

    describe('getInAppCameraVideoPreference()', () => {
        it('resolves false when the settings row is absent', async () => {
            selectSettingMock.mockResolvedValue({ rows: { length: 0 } });

            const result = await initService.getInAppCameraVideoPreference();

            expect(result).toBe(false);
            expect(selectSettingMock).toHaveBeenCalledWith('in_app_camera_video');
        });

        it('resolves true when the stored value is "true"', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'true' }) }
            });

            const result = await initService.getInAppCameraVideoPreference();

            expect(result).toBe(true);
        });

        it('resolves false when the stored value is "false"', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'false' }) }
            });

            const result = await initService.getInAppCameraVideoPreference();

            expect(result).toBe(false);
        });
    });

    describe('getThemePreference()', () => {
        it('resolves "light" when the settings row is absent', async () => {
            selectSettingMock.mockResolvedValue({ rows: { length: 0 } });

            const result = await initService.getThemePreference();

            expect(result).toBe('light');
            expect(selectSettingMock).toHaveBeenCalledWith('theme');
        });

        it('resolves "system" when the stored value is "system"', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'system' }) }
            });

            const result = await initService.getThemePreference();

            expect(result).toBe('system');
        });

        it('resolves "dark" when the stored value is "dark"', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'dark' }) }
            });

            const result = await initService.getThemePreference();

            expect(result).toBe('dark');
        });

        it('resolves "light" when the stored value is not in the whitelist', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'solarized' }) }
            });

            const result = await initService.getThemePreference();

            expect(result).toBe('light');
        });
    });

    describe('getKeepScreenOnDuringTransferPreference()', () => {
        it('resolves false when the settings row is absent', async () => {
            selectSettingMock.mockResolvedValue({ rows: { length: 0 } });

            const result = await initService.getKeepScreenOnDuringTransferPreference();

            expect(result).toBe(false);
            expect(selectSettingMock).toHaveBeenCalledWith('keep_screen_on_during_transfer');
        });

        it('resolves true when the stored value is "true"', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'true' }) }
            });

            const result = await initService.getKeepScreenOnDuringTransferPreference();

            expect(result).toBe(true);
        });

        it('resolves false when the stored value is "false"', async () => {
            selectSettingMock.mockResolvedValue({
                rows: { length: 1, item: () => ({ value: 'false' }) }
            });

            const result = await initService.getKeepScreenOnDuringTransferPreference();

            expect(result).toBe(false);
        });
    });
});

