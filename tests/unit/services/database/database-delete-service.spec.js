import { describe, it, expect, vi } from 'vitest';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { PARAMETERS } from '@/config';

const executeSql = vi.fn();
const transaction = vi.fn();

vi.mock('@/stores/db-store', () => ({
    useDBStore: vi.fn(() => ({
        db: {transaction}
    }))
}));

describe('databaseDeleteService.deleteEntriesBeforeDownload', () => {
    it('deletes only remote entries for the selected forms and related metadata', async () => {
        executeSql.mockImplementation((query, params, success) => {
            success();
            return undefined;
        });
        transaction.mockImplementation((callback, _error, success) => {
            callback({executeSql});
            success();
        });

        await databaseDeleteService.deleteEntriesBeforeDownload('project-ref', ['form-ref']);

        expect(executeSql).toHaveBeenCalledTimes(4);
        expect(executeSql.mock.calls[0][0]).toContain('DELETE FROM media');
        expect(executeSql.mock.calls[1][0]).toContain('DELETE FROM unique_answers');
        expect(executeSql.mock.calls[2][0]).toBe(
            'DELETE FROM entries WHERE project_ref=? AND form_ref=? AND is_remote=?'
        );
        expect(executeSql.mock.calls[2][1]).toEqual([
            'project-ref',
            'form-ref',
            PARAMETERS.REMOTE_CODES.IS
        ]);
        expect(executeSql.mock.calls[3][0]).toBe(
            'DELETE FROM branch_entries WHERE project_ref=? AND form_ref=? AND synced=?'
        );
        expect(executeSql.mock.calls[3][1]).toEqual([
            'project-ref',
            'form-ref',
            PARAMETERS.SYNCED_CODES.SYNCED
        ]);
        expect(executeSql.mock.calls.every(([query]) => query.includes('project_ref'))).toBe(true);
    });

    it('builds statements for every given form', async () => {
        executeSql.mockClear();
        transaction.mockClear();
        executeSql.mockImplementation((query, params, success) => {
            success();
            return undefined;
        });
        transaction.mockImplementation((callback, _error, success) => {
            callback({executeSql});
            success();
        });

        await databaseDeleteService.deleteEntriesBeforeDownload('project-ref', ['form-a', 'form-b', 'form-c']);

        expect(executeSql).toHaveBeenCalledTimes(12);
        const entryDeletes = executeSql.mock.calls.filter(([query]) => query.startsWith('DELETE FROM entries'));
        expect(entryDeletes.map(([, params]) => params[1])).toEqual(['form-a', 'form-b', 'form-c']);
        const branchDeletes = executeSql.mock.calls.filter(([query]) => query.startsWith('DELETE FROM branch_entries'));
        expect(branchDeletes.map(([, params]) => params[1])).toEqual(['form-a', 'form-b', 'form-c']);
        expect(branchDeletes.every(([, params]) => params[2] === PARAMETERS.SYNCED_CODES.SYNCED)).toBe(true);
    });

    it('never deletes bookmarks for re-downloaded entries', async () => {
        executeSql.mockClear();
        transaction.mockClear();
        executeSql.mockImplementation((query, params, success) => {
            success();
            return undefined;
        });
        transaction.mockImplementation((callback, _error, success) => {
            callback({executeSql});
            success();
        });

        await databaseDeleteService.deleteEntriesBeforeDownload('project-ref', ['form-ref']);

        expect(executeSql.mock.calls.some(([query]) => query.includes('DELETE FROM bookmarks'))).toBe(false);
    });

    it('never targets local entries when local and remote rows coexist', async () => {
        executeSql.mockClear();
        transaction.mockClear();
        executeSql.mockImplementation((query, params, success) => {
            success();
            return undefined;
        });
        transaction.mockImplementation((callback, _error, success) => {
            callback({executeSql});
            success();
        });

        const entriesOnDevice = [
            {entryUuid: 'local-entry', isRemote: 0},
            {entryUuid: 'remote-entry', isRemote: PARAMETERS.REMOTE_CODES.IS}
        ];

        await databaseDeleteService.deleteEntriesBeforeDownload('project-ref', ['form-ref']);

        const entryDelete = executeSql.mock.calls.find(([query]) => query.startsWith('DELETE FROM entries'));
        const entryDeleteQuery = entryDelete[0];
        const entryDeleteParams = entryDelete[1];
        const targetedRows = entriesOnDevice.filter((entry) => entry.isRemote === entryDeleteParams[2]);

        expect(entryDeleteQuery).toContain('is_remote=?');
        expect(entryDeleteParams[2]).toBe(PARAMETERS.REMOTE_CODES.IS);
        expect(targetedRows.map((entry) => entry.entryUuid)).toEqual(['remote-entry']);
        expect(targetedRows.map((entry) => entry.entryUuid)).not.toContain('local-entry');
    });
});
