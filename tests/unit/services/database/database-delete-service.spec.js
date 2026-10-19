import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { PARAMETERS } from '@/config';
import { setupDbTest, closeDbTest } from '@/helpers/db-test-setup';
import {
    PROJECT_REF,
    seedProject,
    seedUser,
    seedEntry,
    seedBranchEntry,
    seedTempBranchEntry,
    seedMedia,
    seedUniqueAnswer,
    seedBookmark
} from '@/helpers/db-fixtures';

const removeFiles = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@/services/filesystem/delete-file-service', () => ({
    deleteFileService: {
        removeFiles
    }
}));

function first(db, sql, params) {
    return db.query(sql, params)[0];
}

describe('databaseDeleteService', () => {
    let db;

    beforeEach(async () => {
        vi.clearAllMocks();
        db = await setupDbTest();
    });

    afterEach(closeDbTest);

    it('deleteRowsFromMultipleTables deletes matching rows from every table', async () => {
        seedEntry(db, { entry_uuid: 'entry-a', form_ref: 'form-a' });
        seedEntry(db, { entry_uuid: 'entry-b', form_ref: 'form-b' });
        seedMedia(db, { input_ref: 'photo-input', form_ref: 'form-a', file_name: 'a.jpg' });
        seedMedia(db, { input_ref: 'photo-input', form_ref: 'form-b', file_name: 'b.jpg' });

        await databaseDeleteService.deleteRowsFromMultipleTables('', {
            project_ref: PROJECT_REF,
            form_ref: 'form-a',
            entry_uuid: null
        }, ['entries', 'media']);

        expect(db.query('SELECT entry_uuid FROM entries').map((r) => r.entry_uuid)).toEqual(['entry-b']);
        expect(db.query('SELECT file_name FROM media').map((r) => r.file_name)).toEqual(['b.jpg']);
    });

    it('deleteRowsFromMultipleTables resolves only after the statements complete', async () => {
        seedEntry(db, { entry_uuid: 'entry-a' });
        let resolved = false;

        const promise = databaseDeleteService.deleteRowsFromMultipleTables('', {
            project_ref: PROJECT_REF,
            form_ref: null,
            entry_uuid: null
        }, ['entries']).then(() => {
            resolved = true;
        });

        expect(resolved).toBe(false);
        await promise;
        expect(resolved).toBe(true);
    });

    it('deleteRowsFromMultipleTables rejects and rolls back when a later statement fails', async () => {
        seedEntry(db, { entry_uuid: 'entry-a' });

        await expect(
            databaseDeleteService.deleteRowsFromMultipleTables('', {
                project_ref: PROJECT_REF,
                form_ref: null,
                entry_uuid: null
            }, ['entries', 'table_that_does_not_exist'])
        ).rejects.toThrow(/no such table/i);

        expect(db.query('SELECT entry_uuid FROM entries')).toHaveLength(1);
    });

    it('deleteProject removes the project and all its rows', async () => {
        seedProject(db);
        seedEntry(db, { entry_uuid: 'entry-1' });
        seedMedia(db, { input_ref: 'photo-input', file_name: 'a.jpg' });
        seedBookmark(db);

        await databaseDeleteService.deleteProject(PROJECT_REF);

        expect(db.query('SELECT * FROM projects')).toHaveLength(0);
        expect(db.query('SELECT * FROM entries')).toHaveLength(0);
        expect(db.query('SELECT * FROM media')).toHaveLength(0);
        expect(db.query('SELECT * FROM bookmarks')).toHaveLength(0);
    });

    it('deleteEntries removes the entries but keeps the project', async () => {
        seedProject(db);
        seedEntry(db, { entry_uuid: 'entry-1' });

        await databaseDeleteService.deleteEntries(PROJECT_REF);

        expect(db.query('SELECT * FROM entries')).toHaveLength(0);
        expect(db.query('SELECT * FROM projects')).toHaveLength(1);
    });

    it('deleteEntriesBeforeDownload wipes remote entries, their media, unique answers and synced branches only', async () => {
        seedEntry(db, { entry_uuid: 'remote-1', form_ref: 'form-a', is_remote: PARAMETERS.REMOTE_CODES.IS });
        seedEntry(db, { entry_uuid: 'local-1', form_ref: 'form-a', is_remote: PARAMETERS.REMOTE_CODES.ISNT });
        seedBranchEntry(db, { entry_uuid: 'branch-synced', form_ref: 'form-a', synced: PARAMETERS.SYNCED_CODES.SYNCED });
        seedBranchEntry(db, { entry_uuid: 'branch-unsynced', form_ref: 'form-a', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });
        seedMedia(db, { entry_uuid: 'remote-1', form_ref: 'form-a', input_ref: 'photo-input', file_name: 'remote.jpg' });
        seedMedia(db, { entry_uuid: 'branch-synced', form_ref: 'form-a', input_ref: 'photo-input', file_name: 'branch.jpg' });
        seedUniqueAnswer(db, { entry_uuid: 'remote-1', form_ref: 'form-a' });
        seedUniqueAnswer(db, { entry_uuid: 'branch-synced', form_ref: 'form-a', input_ref: 'other-input' });
        seedTempBranchEntry(db, { entry_uuid: 'temp-1', form_ref: 'form-a' });
        seedUniqueAnswer(db, { entry_uuid: 'temp-1', form_ref: 'form-a', input_ref: 'temp-input' }, true);
        seedBookmark(db, { form_ref: 'form-a' });

        await databaseDeleteService.deleteEntriesBeforeDownload(PROJECT_REF, ['form-a']);

        expect(db.query('SELECT entry_uuid FROM entries').map((r) => r.entry_uuid)).toEqual(['local-1']);
        expect(db.query('SELECT entry_uuid FROM branch_entries').map((r) => r.entry_uuid)).toEqual(['branch-unsynced']);
        expect(db.query('SELECT file_name FROM media')).toHaveLength(0);
        expect(db.query('SELECT * FROM unique_answers')).toHaveLength(0);
        expect(db.query('SELECT * FROM temp_branch_entries')).toHaveLength(0);
        expect(db.query('SELECT * FROM temp_unique_answers')).toHaveLength(0);
        expect(db.query('SELECT * FROM bookmarks')).toHaveLength(1);
        expect(removeFiles).toHaveBeenCalledTimes(1);
        expect(removeFiles.mock.calls[0][0]).toHaveLength(2);
    });

    it('deleteEntriesBeforeDownload skips file removal when there is no media to delete', async () => {
        seedEntry(db, { entry_uuid: 'remote-1', form_ref: 'form-a', is_remote: PARAMETERS.REMOTE_CODES.IS });

        await databaseDeleteService.deleteEntriesBeforeDownload(PROJECT_REF, ['form-a']);

        expect(removeFiles).not.toHaveBeenCalled();
        expect(db.query('SELECT * FROM entries')).toHaveLength(0);
    });

    it('deleteEntriesBeforeDownload wipes remote data for every supplied form', async () => {
        seedEntry(db, { entry_uuid: 'remote-a', form_ref: 'form-a', is_remote: PARAMETERS.REMOTE_CODES.IS });
        seedEntry(db, { entry_uuid: 'remote-b', form_ref: 'form-b', is_remote: PARAMETERS.REMOTE_CODES.IS });
        seedEntry(db, { entry_uuid: 'local-b', form_ref: 'form-b', is_remote: PARAMETERS.REMOTE_CODES.ISNT });
        seedMedia(db, { entry_uuid: 'remote-a', form_ref: 'form-a', input_ref: 'photo-input', file_name: 'a.jpg' });
        seedMedia(db, { entry_uuid: 'remote-b', form_ref: 'form-b', input_ref: 'photo-input', file_name: 'b.jpg' });

        await databaseDeleteService.deleteEntriesBeforeDownload(PROJECT_REF, ['form-a', 'form-b']);

        expect(db.query('SELECT entry_uuid FROM entries').map((r) => r.entry_uuid)).toEqual(['local-b']);
        expect(db.query('SELECT file_name FROM media')).toHaveLength(0);
        expect(removeFiles).toHaveBeenCalledTimes(1);
        expect(removeFiles.mock.calls[0][0]).toHaveLength(2);
    });

    it('deleteEntriesBeforeDownload rejects and deletes nothing when media cleanup fails', async () => {
        seedEntry(db, { entry_uuid: 'remote-1', form_ref: 'form-a', is_remote: PARAMETERS.REMOTE_CODES.IS });
        seedMedia(db, { entry_uuid: 'remote-1', form_ref: 'form-a', input_ref: 'photo-input', file_name: 'remote.jpg' });
        removeFiles.mockRejectedValueOnce(new Error('cleanup failed'));

        await expect(
            databaseDeleteService.deleteEntriesBeforeDownload(PROJECT_REF, ['form-a'])
        ).rejects.toThrow('cleanup failed');

        expect(db.query('SELECT entry_uuid FROM entries')).toHaveLength(1);
        expect(db.query('SELECT file_name FROM media')).toHaveLength(1);
    });

    it('deleteFormEntries only removes rows of the given forms', async () => {
        seedEntry(db, { entry_uuid: 'entry-a', form_ref: 'form-a' });
        seedEntry(db, { entry_uuid: 'entry-b', form_ref: 'form-b' });

        await databaseDeleteService.deleteFormEntries(PROJECT_REF, ['form-b']);

        expect(db.query('SELECT entry_uuid FROM entries').map((r) => r.entry_uuid)).toEqual(['entry-a']);
    });

    it('deleteEntry removes the entry, its branches, unique answers and bookmarks', async () => {
        seedEntry(db, { entry_uuid: 'entry-1' });
        seedBranchEntry(db, { entry_uuid: 'branch-1', owner_entry_uuid: 'entry-1' });
        seedUniqueAnswer(db, { entry_uuid: 'entry-1' });
        seedBookmark(db, { parent_entry_uuid: 'entry-1' });

        await databaseDeleteService.deleteEntry('entry-1');

        expect(db.query('SELECT * FROM entries')).toHaveLength(0);
        expect(db.query('SELECT * FROM branch_entries')).toHaveLength(0);
        expect(db.query('SELECT * FROM unique_answers')).toHaveLength(0);
        expect(db.query('SELECT * FROM bookmarks')).toHaveLength(0);
    });

    it('deleteBranchEntry removes the branch entry and its unique answers', async () => {
        seedBranchEntry(db, { entry_uuid: 'branch-1' });
        seedUniqueAnswer(db, { entry_uuid: 'branch-1' });

        await databaseDeleteService.deleteBranchEntry('branch-1');

        expect(db.query('SELECT * FROM branch_entries')).toHaveLength(0);
        expect(db.query('SELECT * FROM unique_answers')).toHaveLength(0);
    });

    it('deleteToken clears the users table', async () => {
        seedUser(db, { jwt: 'jwt', name: 'User', email: 'user@example.com' });

        await databaseDeleteService.deleteToken();

        expect(db.query('SELECT * FROM users')).toHaveLength(0);
    });

    it('removeUniqueAnswers deletes the unique answers of the given entries', async () => {
        seedUniqueAnswer(db, { entry_uuid: 'entry-1', input_ref: 'a' });
        seedUniqueAnswer(db, { entry_uuid: 'entry-2', input_ref: 'b' });
        seedUniqueAnswer(db, { entry_uuid: 'entry-3', input_ref: 'c' });

        await databaseDeleteService.removeUniqueAnswers({
            rows: {
                length: 2,
                item: (index) => ({ entry_uuid: ['entry-1', 'entry-2'][index] })
            }
        });

        expect(db.query('SELECT entry_uuid FROM unique_answers').map((r) => r.entry_uuid)).toEqual(['entry-3']);
    });

    it('deleteTempBranchEntries clears the temp branch entries', async () => {
        seedTempBranchEntry(db, { entry_uuid: 'temp-1' });

        await databaseDeleteService.deleteTempBranchEntries();

        expect(db.query('SELECT * FROM temp_branch_entries')).toHaveLength(0);
    });

    it('deleteTempUniqueAnswers clears the temp unique answers', async () => {
        seedUniqueAnswer(db, { entry_uuid: 'temp-1' }, true);

        await databaseDeleteService.deleteTempUniqueAnswers();

        expect(db.query('SELECT * FROM temp_unique_answers')).toHaveLength(0);
    });

    it('deleteBookmark removes a single bookmark by id', async () => {
        seedBookmark(db, { title: 'Keep' });
        seedBookmark(db, { title: 'Remove' });
        const { id } = first(db, 'SELECT id FROM bookmarks WHERE title = ?', ['Remove']);

        await databaseDeleteService.deleteBookmark(id);

        expect(db.query('SELECT title FROM bookmarks').map((r) => r.title)).toEqual(['Keep']);
    });

    it('deleteEntryMedia removes all media of an entry', async () => {
        seedMedia(db, { entry_uuid: 'entry-1', file_name: 'a.jpg' });
        seedMedia(db, { entry_uuid: 'entry-1', file_name: 'b.jpg' });
        seedMedia(db, { entry_uuid: 'entry-2', file_name: 'c.jpg' });

        await databaseDeleteService.deleteEntryMedia('entry-1');

        expect(db.query('SELECT file_name FROM media').map((r) => r.file_name)).toEqual(['c.jpg']);
    });

    it('deleteMediaFile removes one media file of an entry', async () => {
        seedMedia(db, { entry_uuid: 'entry-1', file_name: 'a.jpg' });
        seedMedia(db, { entry_uuid: 'entry-1', file_name: 'b.jpg' });

        await databaseDeleteService.deleteMediaFile('entry-1', 'a.jpg');

        expect(db.query('SELECT file_name FROM media').map((r) => r.file_name)).toEqual(['b.jpg']);
    });

    /*
     * Current behaviour, surfaced by the real-SQL harness: deleteMediaFiles
     * interpolates the file names straight into `file_name IN (...)` without
     * quoting, so any real file name (e.g. "photo.jpg") is parsed as an
     * identifier and the statement fails. Reported as a follow-up, not fixed
     * here (out of scope for this harness work).
     */
    it('deleteMediaFiles fails for real file names because they are interpolated unquoted', async () => {
        seedMedia(db, { project_ref: PROJECT_REF, file_name: 'photo.jpg' });

        await expect(
            databaseDeleteService.deleteMediaFiles(PROJECT_REF, ['photo.jpg'])
        ).rejects.toThrow(/no such column/i);
    });
});
