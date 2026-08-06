import { describe, it, expect, vi } from 'vitest';
import { databaseSelectService } from '@/services/database/database-select-service';
import { PARAMETERS } from '@/config';

const executeSql = vi.fn();
const transaction = vi.fn();

vi.mock('@/stores/db-store', () => ({
    useDBStore: vi.fn(() => ({
        db: {transaction}
    }))
}));

describe('databaseSelectService.remoteEntryHasUnsyncedDescendant', () => {

    function mockResult(total) {
        executeSql.mockImplementation((query, params, success) => {
            success(null, {
                rows: {
                    length: 1,
                    item: () => ({total})
                }
            });
            return undefined;
        });
        transaction.mockImplementation((callback, _error, success) => {
            callback({executeSql});
            success();
            return undefined;
        });
    }

    it('returns true when a remote entry has an unsynced child entry', async () => {
        mockResult(1);

        const result = await databaseSelectService.remoteEntryHasUnsyncedDescendant('project-ref', 'form-ref');

        expect(result).toBe(true);

        const query = executeSql.mock.calls[0][0];
        const params = executeSql.mock.calls[0][1];

        expect(query).toContain('SELECT COUNT(*) FROM entries');
        expect(query).toContain('SELECT COUNT(*) FROM branch_entries');
        expect(query).toContain('is_remote=?');
        expect(query).toContain('synced<>?');
        expect(params).toEqual([
            'project-ref', 'form-ref', PARAMETERS.REMOTE_CODES.IS,
            'project-ref', 'project-ref', 'form-ref', PARAMETERS.REMOTE_CODES.IS, PARAMETERS.SYNCED_CODES.SYNCED,
            'project-ref', 'project-ref', 'form-ref', PARAMETERS.REMOTE_CODES.IS, PARAMETERS.SYNCED_CODES.SYNCED
        ]);
    });

    it('returns true when a remote entry has an unsynced branch entry', async () => {
        mockResult(2);

        expect(await databaseSelectService.remoteEntryHasUnsyncedDescendant('project-ref', 'form-ref')).toBe(true);
    });

    it('returns false when there are no unsynced descendants', async () => {
        mockResult(0);

        expect(await databaseSelectService.remoteEntryHasUnsyncedDescendant('project-ref', 'form-ref')).toBe(false);
    });

    it('returns false when the query returns no rows', async () => {
        executeSql.mockImplementation((query, params, success) => {
            success(null, {
                rows: {
                    length: 0,
                    item: () => ({})
                }
            });
            return undefined;
        });
        transaction.mockImplementation((callback, _error, success) => {
            callback({executeSql});
            success();
            return undefined;
        });

        expect(await databaseSelectService.remoteEntryHasUnsyncedDescendant('project-ref', 'form-ref')).toBe(false);
    });
});
