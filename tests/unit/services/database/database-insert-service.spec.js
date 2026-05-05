import { describe, it, expect, beforeEach, vi } from 'vitest';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { useDBStore } from '@/stores/db-store';

vi.mock('@/stores/db-store', () => ({
    useDBStore: vi.fn()
}));

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({}))
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getISODateTime: vi.fn(() => '2026-05-05T12:00:00.000Z'),
        getFilePath: vi.fn(() => '/')
    }
}));

function makeEntry(entryUuid) {
    return {
        entryUuid,
        parentEntryUuid: '',
        projectRef: 'project-ref',
        formRef: 'form-ref',
        parentFormRef: '',
        answers: {
            answer: entryUuid
        },
        canEdit: 0,
        isRemote: 1,
        createdAt: '2026-05-05T10:00:00.000Z',
        updatedAt: '2026-05-05T11:00:00.000Z',
        title: entryUuid
    };
}

describe('databaseInsertService.insertEntries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('inserts all entries in a single transaction using INSERT OR REPLACE', async () => {
        const executeSql = vi.fn((query, params, success) => {
            success({}, { rowsAffected: 1 });
        });
        const transaction = vi.fn((work, onError, onSuccess) => {
            work({ executeSql });
            onSuccess();
        });

        useDBStore.mockReturnValue({
            db: {
                transaction
            }
        });

        await databaseInsertService.insertEntries([
            makeEntry('entry-1'),
            makeEntry('entry-2')
        ], 1);

        expect(transaction).toHaveBeenCalledTimes(1);
        expect(executeSql).toHaveBeenCalledTimes(2);
        expect(executeSql.mock.calls[0][0]).toContain('INSERT OR REPLACE INTO entries');
        expect(executeSql.mock.calls[0][1][0]).toBe('entry-1');
        expect(executeSql.mock.calls[1][1][0]).toBe('entry-2');
    });

    it('rejects when the transaction reports an error', async () => {
        const error = new Error('transaction failed');
        const transaction = vi.fn((work, onError) => {
            onError(error);
        });

        useDBStore.mockReturnValue({
            db: {
                transaction
            }
        });

        await expect(databaseInsertService.insertEntries([
            makeEntry('entry-1')
        ], 1)).rejects.toBe(error);
    });

    it('rejects when a statement reports an error', async () => {
        const error = new Error('insert failed');
        let statementErrorResult;
        const executeSql = vi.fn((query, params, success, onError) => {
            statementErrorResult = onError({}, error);
        });
        const transaction = vi.fn((work) => {
            work({ executeSql });
        });

        useDBStore.mockReturnValue({
            db: {
                transaction
            }
        });

        await expect(databaseInsertService.insertEntries([
            makeEntry('entry-1')
        ], 1)).rejects.toBe(error);
        expect(statementErrorResult).toBe(true);
    });
});
