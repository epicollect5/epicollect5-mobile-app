import { describe, it, expect, vi } from 'vitest';
import { databaseSelectService } from '@/services/database/database-select-service';
import { PARAMETERS } from '@/config';

const executeSql = vi.fn();
const transaction = vi.fn();

vi.mock('@/stores/db-store', () => ({
    useDBStore: vi.fn(() => ({
        db: { transaction }
    }))
}));

function mockDb() {
    executeSql.mockReset();
    transaction.mockReset();
    executeSql.mockImplementation((_query, _params, success) => {
        success({ rows: { item: () => ({}), length: 0 } });
        return undefined;
    });
    transaction.mockImplementation((callback, _error, success) => {
        callback({ executeSql });
        success();
    });
}

describe('databaseSelectService.countUnsyncedEntries', () => {
    it('excludes remote entries from the unsynced count', async () => {
        mockDb();

        await databaseSelectService.countUnsyncedEntries('project-ref');

        expect(executeSql).toHaveBeenCalledTimes(1);
        const query = executeSql.mock.calls[0][0];

        // The full query must contain is_remote = 0 in the unsynced subqueries
        expect(query).toContain('is_remote = 0');
        // Must still have the synced filter
        expect(query).toContain('synced = ? OR synced = ?');
    });

    it('excludes remote branch entries from the unsynced count', async () => {
        mockDb();

        await databaseSelectService.countUnsyncedEntries('project-ref');

        const query = executeSql.mock.calls[0][0];

        // Both entries and branch_entries subqueries must have the filter
        const branchUnsyncedMatch = query.match(/FROM branch_entries[\s\S]*?total_number_of_entries_unsynced/);
        expect(branchUnsyncedMatch).toBeTruthy();
        expect(branchUnsyncedMatch[0]).toContain('is_remote = 0');
    });

    it('still counts local entries as unsynced', async () => {
        mockDb();

        await databaseSelectService.countUnsyncedEntries('project-ref');

        const query = executeSql.mock.calls[0][0];

        // The synced filter must still be present
        expect(query).toContain('synced = ? OR synced = ?');
    });
});

describe('databaseSelectService.countEntriesUnsynced', () => {
    it('excludes remote entries from the unsynced count', async () => {
        mockDb();

        await databaseSelectService.countEntriesUnsynced('project-ref');

        expect(executeSql).toHaveBeenCalledTimes(1);
        const query = executeSql.mock.calls[0][0];

        // Both entries and branch_entries must have is_remote = 0
        expect(query).toContain('is_remote = 0');
    });

    it('does not count remote branch entries', async () => {
        mockDb();

        await databaseSelectService.countEntriesUnsynced('project-ref');

        const query = executeSql.mock.calls[0][0];

        // Verify both subqueries include the filter
        const entrySection = query.split('UNION ALL')[0];
        const branchSection = query.split('UNION ALL')[1];

        expect(entrySection).toContain('is_remote = 0');
        expect(branchSection).toContain('is_remote = 0');
    });
});
