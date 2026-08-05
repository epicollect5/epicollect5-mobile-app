import { describe, it, expect, vi } from 'vitest';
import { databaseUpdateService } from '@/services/database/database-update-service';
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
        success();
        return undefined;
    });
    transaction.mockImplementation((callback, _error, success) => {
        callback({ executeSql });
        success();
    });
}

describe('databaseUpdateService.unsyncAllEntries', () => {
    it('excludes remote entries from unsync', async () => {
        mockDb();

        await databaseUpdateService.unsyncAllEntries('project-ref');

        expect(executeSql).toHaveBeenCalledTimes(1);
        const query = executeSql.mock.calls[0][0];

        expect(query).toContain('is_remote = 0');
        expect(query).toBe(
            'UPDATE entries SET synced=?, synced_error=? WHERE project_ref=? AND synced <? AND is_remote = 0'
        );
    });

    it('does not touch remote entries when local and remote rows coexist', async () => {
        mockDb();

        await databaseUpdateService.unsyncAllEntries('project-ref');

        const query = executeSql.mock.calls[0][0];
        const params = executeSql.mock.calls[0][1];

        expect(query).toContain('is_remote = 0');
        // Only 4 params: synced value, error, projectRef, incomplete threshold
        expect(params).toEqual([0, '', 'project-ref', PARAMETERS.SYNCED_CODES.INCOMPLETE]);
    });
});

describe('databaseUpdateService.unsyncAllBranchEntries', () => {
    it('excludes remote branch entries from unsync', async () => {
        mockDb();

        await databaseUpdateService.unsyncAllBranchEntries('project-ref');

        expect(executeSql).toHaveBeenCalledTimes(1);
        const query = executeSql.mock.calls[0][0];

        expect(query).toContain('is_remote = 0');
        expect(query).toBe(
            'UPDATE branch_entries SET synced=?, synced_error=? WHERE project_ref=? AND synced <? AND is_remote = 0'
        );
    });
});

describe('databaseUpdateService.unsyncParentEntry', () => {
    it('excludes remote entries from parent unsync', async () => {
        mockDb();

        await databaseUpdateService.unsyncParentEntry('project-ref', 'parent-uuid');

        expect(executeSql).toHaveBeenCalledTimes(1);
        const query = executeSql.mock.calls[0][0];

        expect(query).toContain('is_remote = 0');
        expect(query).toBe(
            'UPDATE entries SET synced=?, synced_error=? WHERE project_ref=? AND entry_uuid=? AND synced =? AND is_remote = 0'
        );
    });

    it('does not unsync a remote parent entry', async () => {
        mockDb();

        await databaseUpdateService.unsyncParentEntry('project-ref', 'remote-parent-uuid');

        const query = executeSql.mock.calls[0][0];
        const params = executeSql.mock.calls[0][1];

        expect(query).toContain('is_remote = 0');
        expect(params).toEqual([
            PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES,
            '',
            'project-ref',
            'remote-parent-uuid',
            PARAMETERS.SYNCED_CODES.SYNCED
        ]);
    });
});
