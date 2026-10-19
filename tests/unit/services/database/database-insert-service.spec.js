import { describe, it, expect, beforeEach, vi } from 'vitest';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { PARAMETERS } from '@/config';
import { setupDbTest } from '@/helpers/db-test-setup';
import { PROJECT_REF, FORM_REF, SERVER_URL, seedMedia, seedTempBranchEntry, seedUniqueAnswer } from '@/helpers/db-fixtures';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en',
        persistentDir: '/media/'
    }))
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getISODateTime: vi.fn(() => '2026-05-05T12:00:00.000Z'),
        getFilePath: vi.fn(() => 'photos/')
    }
}));

function makeEntry(entryUuid, overrides = {}) {
    return {
        entryUuid,
        parentEntryUuid: '',
        projectRef: PROJECT_REF,
        formRef: FORM_REF,
        parentFormRef: '',
        answers: { answer: entryUuid },
        canEdit: 0,
        isRemote: PARAMETERS.REMOTE_CODES.IS,
        createdAt: '2026-05-05T10:00:00.000Z',
        updatedAt: '2026-05-05T11:00:00.000Z',
        title: entryUuid,
        ...overrides
    };
}

function makeMediaFile(overrides = {}) {
    return {
        stored: '',
        cached: 'photo.jpg',
        input_ref: 'photo-input',
        type: PARAMETERS.QUESTION_TYPES.PHOTO,
        entry_uuid: 'entry-1',
        ...overrides
    };
}

describe('databaseInsertService', () => {
    let db;

    beforeEach(async () => {
        vi.clearAllMocks();
        db = await setupDbTest();
    });

    it('insertProject writes the project row', async () => {
        await databaseInsertService.insertProject('slug', 'Name', PROJECT_REF, '{}', SERVER_URL, '2026-01-01T00:00:00.000Z', '[]');

        const rows = db.query('SELECT name, slug, mapping FROM projects WHERE project_ref = ?', [PROJECT_REF]);

        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Name');
        expect(rows[0].mapping).toBe('[]');
    });

    it('insertUser writes the user row with name and email', async () => {
        await databaseInsertService.insertUser('jwt', 'User', 'user@example.com');

        const rows = db.query('SELECT jwt, name, email FROM users');

        expect(rows).toEqual([{ jwt: 'jwt', name: 'User', email: 'user@example.com' }]);
    });

    it('insertEntry writes the entry with serialised answers', async () => {
        await databaseInsertService.insertEntry(makeEntry('entry-1'), PARAMETERS.SYNCED_CODES.SYNCED);

        const rows = db.query('SELECT entry_uuid, answers, title FROM entries WHERE entry_uuid = ?', ['entry-1']);

        expect(rows).toHaveLength(1);
        expect(rows[0].title).toBe('entry-1');
        expect(JSON.parse(rows[0].answers)).toEqual({ answer: 'entry-1' });
    });

    it('insertEntries writes every entry in a single transaction', async () => {
        await databaseInsertService.insertEntries([makeEntry('entry-1'), makeEntry('entry-2')], PARAMETERS.SYNCED_CODES.SYNCED);

        const rows = db.query('SELECT entry_uuid FROM entries ORDER BY entry_uuid');

        expect(rows.map((row) => row.entry_uuid)).toEqual(['entry-1', 'entry-2']);
    });

    it('insertMedia inserts a new media row when the filename does not exist', async () => {
        await databaseInsertService.insertMedia(makeEntry('entry-1'), [makeMediaFile()], PARAMETERS.SYNCED_CODES.SYNCED);

        const rows = db.query('SELECT file_name, file_path, synced FROM media');

        expect(rows).toHaveLength(1);
        expect(rows[0].file_name).toBe('photo.jpg');
        expect(rows[0].file_path).toBe('/media/photos/');
        expect(rows[0].synced).toBe(PARAMETERS.SYNCED_CODES.SYNCED);
    });

    it('insertMedia marks an existing filename unsynced instead of duplicating it', async () => {
        seedMedia(db, { file_name: 'photo.jpg', synced: PARAMETERS.SYNCED_CODES.SYNCED });

        await databaseInsertService.insertMedia(makeEntry('entry-1'), [makeMediaFile()], PARAMETERS.SYNCED_CODES.SYNCED);

        const rows = db.query('SELECT file_name, synced FROM media');

        expect(rows).toHaveLength(1);
        expect(rows[0].synced).toBe(PARAMETERS.SYNCED_CODES.UNSYNCED);
    });

    it('moveBranchEntries moves temp branch entries into branch_entries', async () => {
        seedTempBranchEntry(db, { entry_uuid: 'temp-branch-1' });

        await databaseInsertService.moveBranchEntries();

        expect(db.query('SELECT entry_uuid FROM branch_entries').map((r) => r.entry_uuid)).toEqual(['temp-branch-1']);
        expect(db.query('SELECT entry_uuid FROM temp_branch_entries')).toHaveLength(0);
    });

    it('insertTempBranchEntry writes a temporary branch entry', async () => {
        await databaseInsertService.insertTempBranchEntry({
            entryUuid: 'temp-branch-1',
            ownerEntryUuid: 'entry-1',
            ownerInputRef: 'branch-input',
            projectRef: PROJECT_REF,
            formRef: FORM_REF,
            answers: { b1: 'a1' },
            title: 'Temp'
        }, PARAMETERS.SYNCED_CODES.UNSYNCED);

        const rows = db.query('SELECT entry_uuid, owner_entry_uuid FROM temp_branch_entries');

        expect(rows).toEqual([{ entry_uuid: 'temp-branch-1', owner_entry_uuid: 'entry-1' }]);
    });

    it('insertUniqueAnswers writes into unique_answers by default', async () => {
        await databaseInsertService.insertUniqueAnswers(makeEntry('entry-1', {
            uniqueAnswers: { 'unique-input': 'unique-answer' }
        }), false);

        const rows = db.query('SELECT entry_uuid, input_ref, answer, form_ref FROM unique_answers');

        expect(rows).toEqual([{
            entry_uuid: 'entry-1',
            input_ref: 'unique-input',
            answer: 'unique-answer',
            form_ref: FORM_REF
        }]);
    });

    it('insertUniqueAnswers writes into temp_unique_answers when requested', async () => {
        await databaseInsertService.insertUniqueAnswers(makeEntry('entry-1', {
            uniqueAnswers: { 'unique-input': 'unique-answer' }
        }), true);

        expect(db.query('SELECT entry_uuid FROM temp_unique_answers')).toHaveLength(1);
        expect(db.query('SELECT entry_uuid FROM unique_answers')).toHaveLength(0);
    });

    it('moveUniqueAnswers moves temp answers into unique_answers', async () => {
        seedUniqueAnswer(db, { entry_uuid: 'entry-1' }, true);

        await databaseInsertService.moveUniqueAnswers();

        expect(db.query('SELECT entry_uuid FROM unique_answers').map((r) => r.entry_uuid)).toEqual(['entry-1']);
        expect(db.query('SELECT entry_uuid FROM temp_unique_answers')).toHaveLength(0);
    });

    it('insertSetting writes a setting row', async () => {
        await databaseInsertService.insertSetting('order_by', '{"field":"title"}');

        const rows = db.query('SELECT value FROM settings WHERE field = ?', ['order_by']);

        expect(rows).toEqual([{ value: '{"field":"title"}' }]);
    });

    it('insertBookmark writes a bookmark row', async () => {
        await databaseInsertService.insertBookmark(PROJECT_REF, FORM_REF, 'Title', '{}', 'entry-1');

        const rows = db.query('SELECT title, parent_entry_uuid FROM bookmarks');

        expect(rows).toEqual([{ title: 'Title', parent_entry_uuid: 'entry-1' }]);
    });

    it('insertCloneEntry writes a cloned entry row', async () => {
        await databaseInsertService.insertCloneEntry(makeEntry('clone-1'));

        expect(db.query('SELECT entry_uuid FROM entries').map((r) => r.entry_uuid)).toEqual(['clone-1']);
    });

    it('insertCloneEntryBranch writes a cloned temp branch entry', async () => {
        await databaseInsertService.insertCloneEntryBranch({
            entryUuid: 'clone-branch-1',
            ownerEntryUuid: 'entry-1',
            ownerInputRef: 'branch-input',
            projectRef: PROJECT_REF,
            formRef: FORM_REF,
            answers: {},
            synced: PARAMETERS.SYNCED_CODES.UNSYNCED,
            syncedError: '',
            canEdit: 0,
            isRemote: PARAMETERS.REMOTE_CODES.ISNT,
            createdAt: '2026-05-05T10:00:00.000Z',
            updatedAt: '2026-05-05T11:00:00.000Z',
            title: 'Clone branch'
        });

        expect(db.query('SELECT entry_uuid FROM temp_branch_entries').map((r) => r.entry_uuid)).toEqual(['clone-branch-1']);
    });

    it('rejects when the bound params do not match the placeholders', async () => {
        await expect(
            databaseInsertService.insertRows('INSERT INTO settings (field, value) VALUES (?,?)', ['only-one'])
        ).rejects.toThrow(/binding mismatch/i);
    });
});
