import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { PARAMETERS } from '@/config';
import { setupDbTest, closeDbTest } from '@/helpers/db-test-setup';
import { PROJECT_REF, seedEntry, seedBranchEntry, seedMedia, seedProject } from '@/helpers/db-fixtures';

function first(db, sql, params) {
    return db.query(sql, params)[0];
}

describe('databaseUpdateService', () => {
    let db;

    beforeEach(async () => {
        vi.clearAllMocks();
        db = await setupDbTest();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        closeDbTest();
    });

    it('updateSynced updates an entry and stores the serialised error', async () => {
        seedEntry(db, { entry_uuid: 'entry-1', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });

        await databaseUpdateService.updateSynced(PARAMETERS.ENTRY, 'entry-1', PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, { code: 'ec5_1' });

        const row = first(db, 'SELECT synced, synced_error FROM entries WHERE entry_uuid = ?', ['entry-1']);
        expect(row.synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR);
        expect(JSON.parse(row.synced_error)).toEqual({ code: 'ec5_1' });
    });

    it('updateSynced targets branch_entries for a branch entry', async () => {
        seedBranchEntry(db, { entry_uuid: 'branch-1', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });

        await databaseUpdateService.updateSynced(PARAMETERS.BRANCH_ENTRY, 'branch-1', PARAMETERS.SYNCED_CODES.SYNCED);

        const row = first(db, 'SELECT synced FROM branch_entries WHERE entry_uuid = ?', ['branch-1']);
        expect(row.synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED);
    });

    it('updateEntrySynced sets the synced flag', async () => {
        seedEntry(db, { entry_uuid: 'entry-1', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });

        await databaseUpdateService.updateEntrySynced('entry-1', PARAMETERS.SYNCED_CODES.SYNCED);

        expect(first(db, 'SELECT synced FROM entries WHERE entry_uuid = ?', ['entry-1']).synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED);
    });

    it('updateBranchEntrySynced sets the synced flag', async () => {
        seedBranchEntry(db, { entry_uuid: 'branch-1', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });

        await databaseUpdateService.updateBranchEntrySynced('branch-1', PARAMETERS.SYNCED_CODES.SYNCED);

        expect(first(db, 'SELECT synced FROM branch_entries WHERE entry_uuid = ?', ['branch-1']).synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED);
    });

    it('updateFileEntrySynced stores the error when a media file fails', async () => {
        seedMedia(db, { file_name: 'photo.jpg', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });
        const { id } = first(db, 'SELECT id FROM media');

        await databaseUpdateService.updateFileEntrySynced(id, PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, { code: 'ec5_2' });

        const row = first(db, 'SELECT synced, synced_error FROM media WHERE id = ?', [id]);
        expect(row.synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR);
        expect(JSON.parse(row.synced_error)).toEqual({ code: 'ec5_2' });
    });

    it('updateFileEntrySynced clears a previous error when the file syncs', async () => {
        seedMedia(db, { file_name: 'photo.jpg', synced: PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, synced_error: '{"code":"ec5_2"}' });
        const { id } = first(db, 'SELECT id FROM media');

        await databaseUpdateService.updateFileEntrySynced(id, PARAMETERS.SYNCED_CODES.SYNCED);

        const row = first(db, 'SELECT synced, synced_error FROM media WHERE id = ?', [id]);
        expect(row.synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED);
        expect(row.synced_error).toBe('');
    });

    // The error branch and the clear-on-sync branch are mutually exclusive, so
    // synced_error is assigned at most once per UPDATE. Every combination of
    // sync status and error presence is covered to pin that.
    it.each([
        ['unsynced without an error keeps the previous error', PARAMETERS.SYNCED_CODES.UNSYNCED, undefined, PARAMETERS.SYNCED_CODES.UNSYNCED, '{"code":"ec5_old"}'],
        ['unsynced with an error records the error', PARAMETERS.SYNCED_CODES.UNSYNCED, { code: 'ec5_2' }, PARAMETERS.SYNCED_CODES.UNSYNCED, '{"code":"ec5_2"}'],
        ['synced without an error clears the previous error', PARAMETERS.SYNCED_CODES.SYNCED, undefined, PARAMETERS.SYNCED_CODES.SYNCED, ''],
        ['synced with an error records the error', PARAMETERS.SYNCED_CODES.SYNCED, { code: 'ec5_2' }, PARAMETERS.SYNCED_CODES.SYNCED, '{"code":"ec5_2"}'],
        ['synced with error status and no error keeps the previous error', PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, undefined, PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, '{"code":"ec5_old"}'],
        ['synced with error status and an error records the error', PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, { code: 'ec5_2' }, PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, '{"code":"ec5_2"}'],
        ['incomplete without an error keeps the previous error', PARAMETERS.SYNCED_CODES.INCOMPLETE, undefined, PARAMETERS.SYNCED_CODES.INCOMPLETE, '{"code":"ec5_old"}'],
        ['incomplete with an error records the error', PARAMETERS.SYNCED_CODES.INCOMPLETE, { code: 'ec5_2' }, PARAMETERS.SYNCED_CODES.INCOMPLETE, '{"code":"ec5_2"}'],
        ['has unsynced children without an error keeps the previous error', PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES, undefined, PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES, '{"code":"ec5_old"}'],
        ['has unsynced children with an error records the error', PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES, { code: 'ec5_2' }, PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES, '{"code":"ec5_2"}']
    ])('updateFileEntrySynced: %s', async (label, sync, syncedError, expectedSynced, expectedSyncedError) => {
        seedMedia(db, { file_name: 'photo.jpg', synced: PARAMETERS.SYNCED_CODES.UNSYNCED, synced_error: '{"code":"ec5_old"}' });
        const { id } = first(db, 'SELECT id FROM media');

        const updateRowsSpy = vi.spyOn(databaseUpdateService, 'updateRows');

        await databaseUpdateService.updateFileEntrySynced(id, sync, syncedError);

        const row = first(db, 'SELECT synced, synced_error FROM media WHERE id = ?', [id]);
        expect(row.synced).toBe(expectedSynced);
        expect(row.synced_error).toBe(expectedSyncedError);

        //the same column is never assigned twice in one UPDATE
        const [query] = updateRowsSpy.mock.calls[0];
        expect((query.match(/synced_error=/g) || []).length).toBeLessThanOrEqual(1);
    });

    it('updateFileEntryIncomplete only touches incomplete media for the entry', async () => {
        seedMedia(db, { entry_uuid: 'entry-1', file_name: 'incomplete.jpg', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });
        seedMedia(db, { entry_uuid: 'entry-1', file_name: 'synced.jpg', synced: PARAMETERS.SYNCED_CODES.SYNCED });

        await databaseUpdateService.updateFileEntryIncomplete('entry-1');

        expect(first(db, 'SELECT synced FROM media WHERE file_name = ?', ['incomplete.jpg']).synced).toBe(PARAMETERS.SYNCED_CODES.UNSYNCED);
        expect(first(db, 'SELECT synced FROM media WHERE file_name = ?', ['synced.jpg']).synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED);
    });

    it('unsyncAllEntries unsyncs every non-incomplete entry of the project', async () => {
        seedEntry(db, { entry_uuid: 'entry-1', synced: PARAMETERS.SYNCED_CODES.SYNCED });
        seedEntry(db, { entry_uuid: 'entry-2', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });
        seedEntry(db, { entry_uuid: 'entry-3', project_ref: 'other-project', synced: PARAMETERS.SYNCED_CODES.SYNCED });

        await databaseUpdateService.unsyncAllEntries(PROJECT_REF);

        expect(first(db, 'SELECT synced FROM entries WHERE entry_uuid = ?', ['entry-1']).synced).toBe(PARAMETERS.SYNCED_CODES.UNSYNCED);
        expect(first(db, 'SELECT synced FROM entries WHERE entry_uuid = ?', ['entry-2']).synced).toBe(PARAMETERS.SYNCED_CODES.INCOMPLETE);
        expect(first(db, 'SELECT synced FROM entries WHERE entry_uuid = ?', ['entry-3']).synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED);
    });

    it('unsyncAllFileEntries unsyncs every media file of the project', async () => {
        seedMedia(db, { entry_uuid: 'entry-1', file_name: 'a.jpg', synced: PARAMETERS.SYNCED_CODES.SYNCED });
        seedMedia(db, { entry_uuid: 'entry-1', file_name: 'b.jpg', project_ref: 'other-project', synced: PARAMETERS.SYNCED_CODES.SYNCED });

        await databaseUpdateService.unsyncAllFileEntries(PROJECT_REF);

        expect(first(db, 'SELECT synced FROM media WHERE file_name = ?', ['a.jpg']).synced).toBe(PARAMETERS.SYNCED_CODES.UNSYNCED);
        expect(first(db, 'SELECT synced FROM media WHERE file_name = ?', ['b.jpg']).synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED);
    });

    it('unsyncParentEntry only flags a parent that was synced', async () => {
        seedEntry(db, { entry_uuid: 'parent-synced', synced: PARAMETERS.SYNCED_CODES.SYNCED });
        seedEntry(db, { entry_uuid: 'parent-unsynced', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });

        await databaseUpdateService.unsyncParentEntry(PROJECT_REF, 'parent-synced');
        await databaseUpdateService.unsyncParentEntry(PROJECT_REF, 'parent-unsynced');

        expect(first(db, 'SELECT synced FROM entries WHERE entry_uuid = ?', ['parent-synced']).synced).toBe(PARAMETERS.SYNCED_CODES.HAS_UNSYNCED_CHILD_ENTRIES);
        expect(first(db, 'SELECT synced FROM entries WHERE entry_uuid = ?', ['parent-unsynced']).synced).toBe(PARAMETERS.SYNCED_CODES.UNSYNCED);
    });

    it('unsyncAllBranchEntries unsyncs non-incomplete branch entries of the project', async () => {
        seedBranchEntry(db, { entry_uuid: 'branch-1', synced: PARAMETERS.SYNCED_CODES.SYNCED });
        seedBranchEntry(db, { entry_uuid: 'branch-2', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });

        await databaseUpdateService.unsyncAllBranchEntries(PROJECT_REF);

        expect(first(db, 'SELECT synced FROM branch_entries WHERE entry_uuid = ?', ['branch-1']).synced).toBe(PARAMETERS.SYNCED_CODES.UNSYNCED);
        expect(first(db, 'SELECT synced FROM branch_entries WHERE entry_uuid = ?', ['branch-2']).synced).toBe(PARAMETERS.SYNCED_CODES.INCOMPLETE);
    });

    it('updateProject updates json_extra, mapping and last_updated', async () => {
        seedProject(db);

        await databaseUpdateService.updateProject(PROJECT_REF, '{"a":1}', '[{"id":1}]', '2026-02-02T00:00:00.000Z');

        const row = first(db, 'SELECT json_extra, mapping, last_updated FROM projects WHERE project_ref = ?', [PROJECT_REF]);
        expect(row.json_extra).toBe('{"a":1}');
        expect(row.mapping).toBe('[{"id":1}]');
        expect(row.last_updated).toBe('2026-02-02T00:00:00.000Z');
    });

    it('updateEntryAnswers updates answers by row id', async () => {
        seedEntry(db, { entry_uuid: 'entry-1', answers: '{}' });
        const { id } = first(db, 'SELECT id FROM entries WHERE entry_uuid = ?', ['entry-1']);

        await databaseUpdateService.updateEntryAnswers(PARAMETERS.ENTRIES_TABLE, id, '{"q1":"updated"}');

        expect(first(db, 'SELECT answers FROM entries WHERE id = ?', [id]).answers).toBe('{"q1":"updated"}');
    });

    it('updateEntryAnswers can target the branch_entries table', async () => {
        seedBranchEntry(db, { entry_uuid: 'branch-1', answers: '{}' });
        const { id } = first(db, 'SELECT id FROM branch_entries WHERE entry_uuid = ?', ['branch-1']);

        await databaseUpdateService.updateEntryAnswers(PARAMETERS.BRANCH_ENTRIES_TABLE, id, '{"b1":"updated"}');

        expect(first(db, 'SELECT answers FROM branch_entries WHERE id = ?', [id]).answers).toBe('{"b1":"updated"}');
    });
});
