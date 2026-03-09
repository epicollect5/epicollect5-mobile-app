// noinspection JSVoidFunctionReturnValueUsed,DuplicatedCode

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { databaseExportService } from '@/services/database/database-export-service';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';

// Mock dependencies
vi.mock('@/stores/root-store');
vi.mock('@/config', () => ({
    PARAMETERS: {
        DB_NAME: 'epicollect.db',
        ANDROID: 'android',
        IOS: 'ios'
    }
}));

describe('Database Export Service', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    describe('getPluginDbDirectory()', () => {
        it('should return Library/LocalDatabase path for iOS with default location', () => {
            const mockRootStore = {
                device: {
                    platform: PARAMETERS.IOS
                },
                iosDatabaseLocation: 'default'
            };
            useRootStore.mockReturnValue(mockRootStore);

            global.cordova = {
                file: {
                    applicationStorageDirectory: '/app/',
                    documentsDirectory: '/documents/'
                }
            };

            const result = databaseExportService.getPluginDbDirectory();
            expect(result).toBe('/app/Library/LocalDatabase/');
        });

        it('should return Documents path for iOS with Documents location', () => {
            const mockRootStore = {
                device: {
                    platform: PARAMETERS.IOS
                },
                iosDatabaseLocation: 'Documents'
            };
            useRootStore.mockReturnValue(mockRootStore);

            global.cordova = {
                file: {
                    applicationStorageDirectory: '/app/',
                    documentsDirectory: '/documents/'
                }
            };

            const result = databaseExportService.getPluginDbDirectory();
            expect(result).toBe('/documents/');
        });

        it('should return default Library/LocalDatabase path for iOS when iosDatabaseLocation is not set', () => {
            const mockRootStore = {
                device: {
                    platform: PARAMETERS.IOS
                },
                iosDatabaseLocation: undefined
            };
            useRootStore.mockReturnValue(mockRootStore);

            global.cordova = {
                file: {
                    applicationStorageDirectory: '/app/',
                    documentsDirectory: '/documents/'
                }
            };

            const result = databaseExportService.getPluginDbDirectory();
            expect(result).toBe('/app/Library/LocalDatabase/');
        });

        it('should return databases path for Android', () => {
            const mockRootStore = {
                device: {
                    platform: PARAMETERS.ANDROID
                },
                iosDatabaseLocation: 'default'
            };
            useRootStore.mockReturnValue(mockRootStore);

            global.cordova = {
                file: {
                    applicationStorageDirectory: '/app/'
                }
            };

            const result = databaseExportService.getPluginDbDirectory();
            expect(result).toBe('/app/databases/');
        });
    });

    describe('openDatabase()', () => {
        it('should open database with iosDatabaseLocation for iOS with default location', async () => {
            const mockDb = { id: 'test-db' };
            const mockRootStore = {
                device: {
                    platform: PARAMETERS.IOS
                },
                iosDatabaseLocation: 'default'
            };
            useRootStore.mockReturnValue(mockRootStore);

            window.sqlitePlugin = {
                openDatabase: vi.fn().mockImplementation((config, success) => {
                    // Defer so the service's 'db' variable is assigned before success fires
                    Promise.resolve().then(() => success());
                    return mockDb;
                })
            };

            const db = await databaseExportService.openDatabase('test.db');

            expect(db).toBe(mockDb);
            expect(window.sqlitePlugin.openDatabase).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'test.db',
                    iosDatabaseLocation: 'default'
                }),
                expect.any(Function),
                expect.any(Function)
            );
        });

        it('should open database with iosDatabaseLocation for iOS with Documents location', async () => {
            const mockDb = { id: 'test-db' };
            const mockRootStore = {
                device: {
                    platform: PARAMETERS.IOS
                },
                iosDatabaseLocation: 'Documents'
            };
            useRootStore.mockReturnValue(mockRootStore);

            window.sqlitePlugin = {
                openDatabase: vi.fn().mockImplementation((config, success) => {
                    Promise.resolve().then(() => success());
                    return mockDb;
                })
            };

            const db = await databaseExportService.openDatabase('test.db');

            expect(db).toBe(mockDb);
            expect(window.sqlitePlugin.openDatabase).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'test.db',
                    iosDatabaseLocation: 'Documents'
                }),
                expect.any(Function),
                expect.any(Function)
            );
        });

        it('should open database with location for Android', async () => {
            const mockDb = { id: 'test-db' };
            const mockRootStore = {
                device: {
                    platform: PARAMETERS.ANDROID
                },
                iosDatabaseLocation: 'default'
            };
            useRootStore.mockReturnValue(mockRootStore);

            window.sqlitePlugin = {
                openDatabase: vi.fn().mockImplementation((config, success) => {
                    Promise.resolve().then(() => success());
                    return mockDb;
                })
            };

            const db = await databaseExportService.openDatabase('test.db');

            expect(db).toBe(mockDb);
            expect(window.sqlitePlugin.openDatabase).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'test.db',
                    location: 'default'
                }),
                expect.any(Function),
                expect.any(Function)
            );
            expect(window.sqlitePlugin.openDatabase).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    iosDatabaseLocation: expect.anything()
                }),
                expect.any(Function),
                expect.any(Function)
            );
        });

        it('should reject when opening database fails', async () => {
            const mockError = new Error('Failed to open database');
            const mockRootStore = {
                device: {
                    platform: PARAMETERS.IOS
                },
                iosDatabaseLocation: 'default'
            };
            useRootStore.mockReturnValue(mockRootStore);

            window.sqlitePlugin = {
                openDatabase: vi.fn().mockImplementation((config, success, error) => {
                    // Error can fire synchronously — it doesn't reference 'db'
                    error(mockError);
                })
            };

            await expect(databaseExportService.openDatabase('test.db')).rejects.toEqual(mockError);
        });
    });
});
