import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { databaseSelectService } from '@/services/database/database-select-service';
import { PARAMETERS } from '@/config';
import { setupDbTest, closeDbTest } from '@/helpers/db-test-setup';
import {
    PROJECT_REF,
    FORM_REF,
    seedProject,
    seedUser,
    seedEntry,
    seedBranchEntry,
    seedTempBranchEntry,
    seedMedia,
    seedUniqueAnswer,
    seedSetting,
    seedBookmark
} from '@/helpers/db-fixtures';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        device: {
            platform: 'web'
        }
    }))
}));

function rowsToList(result) {
    const list = [];
    for (let index = 0; index < result.rows.length; index++) {
        list.push(result.rows.item(index));
    }
    return list;
}

describe('databaseSelectService', () => {
    let db;

    beforeEach(async () => {
        vi.clearAllMocks();
        db = await setupDbTest();
    });

    afterEach(closeDbTest);

    describe('settings, users and projects', () => {
        it('selectSetting returns the value for a field', async () => {
            seedSetting(db, { field: 'order_by', value: '{"field":"title"}' });

            const result = await databaseSelectService.selectSetting('order_by');

            expect(rowsToList(result)).toEqual([{ value: '{"field":"title"}' }]);
        });

        it('getUser returns the stored user', async () => {
            seedUser(db, { jwt: 'jwt', name: 'User', email: 'user@example.com' });

            const result = await databaseSelectService.getUser();

            expect(rowsToList(result)).toEqual([expect.objectContaining({ jwt: 'jwt', name: 'User', email: 'user@example.com' })]);
        });

        it('selectProject returns a single project by ref', async () => {
            seedProject(db, { name: 'My project' });
            seedProject(db, { project_ref: 'other-project', name: 'Other' });

            const result = await databaseSelectService.selectProject(PROJECT_REF);

            expect(rowsToList(result)).toHaveLength(1);
            expect(result.rows.item(0).name).toBe('My project');
        });

        it('selectProjects returns every project', async () => {
            seedProject(db, { name: 'A' });
            seedProject(db, { project_ref: 'other-project', name: 'B' });

            const result = await databaseSelectService.selectProjects();

            expect(rowsToList(result).map((row) => row.name).sort()).toEqual(['A', 'B']);
        });
    });

    describe('entries', () => {
        it('selectEntry returns the entry by uuid', async () => {
            seedEntry(db, { entry_uuid: 'entry-1', title: 'Entry' });

            const result = await databaseSelectService.selectEntry('entry-1');

            expect(result.rows.item(0).title).toBe('Entry');
        });

        it('selectOneEntry filters by form and synced codes', async () => {
            seedEntry(db, { entry_uuid: 'synced', form_ref: FORM_REF, synced: PARAMETERS.SYNCED_CODES.SYNCED, created_at: '2026-01-02T00:00:00.000Z' });
            seedEntry(db, { entry_uuid: 'unsynced', form_ref: FORM_REF, synced: PARAMETERS.SYNCED_CODES.UNSYNCED, created_at: '2026-01-01T00:00:00.000Z' });

            const result = await databaseSelectService.selectOneEntry(PROJECT_REF, FORM_REF, null, [PARAMETERS.SYNCED_CODES.SYNCED], null);

            expect(result.rows.length).toBe(1);
            expect(result.rows.item(0).entry_uuid).toBe('synced');
        });

        it('selectOneEntry applies an offset', async () => {
            seedEntry(db, { entry_uuid: 'newest', form_ref: FORM_REF, created_at: '2026-01-02T00:00:00.000Z' });
            seedEntry(db, { entry_uuid: 'oldest', form_ref: FORM_REF, created_at: '2026-01-01T00:00:00.000Z' });

            const result = await databaseSelectService.selectOneEntry(PROJECT_REF, FORM_REF, null, null, 1);

            expect(result.rows.item(0).entry_uuid).toBe('oldest');
        });

        it('selectEntries orders, filters by status and paginates', async () => {
            seedEntry(db, { entry_uuid: 'a', form_ref: FORM_REF, title: 'A', created_at: '2026-01-02T00:00:00.000Z' });
            seedEntry(db, { entry_uuid: 'b', form_ref: FORM_REF, title: 'B', created_at: '2026-01-01T00:00:00.000Z' });
            seedEntry(db, { entry_uuid: 'c', form_ref: FORM_REF, title: 'C', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE, created_at: '2026-01-03T00:00:00.000Z' });

            const ordered = await databaseSelectService.selectEntries(PROJECT_REF, FORM_REF, '', { field: 'created_at', sortType: 'DESC' }, null, null, null, PARAMETERS.STATUS.ALL);
            expect(rowsToList(ordered).map((row) => row.entry_uuid)).toEqual(['c', 'a', 'b']);

            const paged = await databaseSelectService.selectEntries(PROJECT_REF, FORM_REF, '', { field: 'created_at', sortType: 'DESC' }, 1, 1, null, PARAMETERS.STATUS.ALL);
            expect(rowsToList(paged).map((row) => row.entry_uuid)).toEqual(['a']);

            const incomplete = await databaseSelectService.selectEntries(PROJECT_REF, FORM_REF, '', null, null, null, null, PARAMETERS.STATUS.INCOMPLETE);
            expect(rowsToList(incomplete).map((row) => row.entry_uuid)).toEqual(['c']);
        });

        it('countEntries filters and reports totals', async () => {
            seedEntry(db, { entry_uuid: 'a', form_ref: FORM_REF, created_at: '2026-01-02T00:00:00.000Z' });
            seedEntry(db, { entry_uuid: 'b', form_ref: FORM_REF, created_at: '2026-01-01T00:00:00.000Z' });

            const result = await databaseSelectService.countEntries(PROJECT_REF, FORM_REF, '', null, null);

            expect(result.rows.item(0).total).toBe(2);
            expect(result.rows.item(0).newest).toBe('2026-01-02T00:00:00.000Z');
            expect(result.rows.item(0).oldest).toBe('2026-01-01T00:00:00.000Z');
        });

        it('countAllEntries counts every entry of the project', async () => {
            seedEntry(db, { entry_uuid: 'a' });
            seedEntry(db, { entry_uuid: 'b' });
            seedEntry(db, { entry_uuid: 'c', project_ref: 'other-project' });

            await expect(databaseSelectService.countAllEntries(PROJECT_REF)).resolves.toBe(2);
        });

        it('countUnsyncedEntries reports totals, errors, unsynced and incomplete', async () => {
            seedEntry(db, { entry_uuid: 'ok', synced: PARAMETERS.SYNCED_CODES.SYNCED });
            seedEntry(db, { entry_uuid: 'unsynced', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });
            seedEntry(db, { entry_uuid: 'error', synced: PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR });
            seedBranchEntry(db, { entry_uuid: 'branch', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });

            const result = await databaseSelectService.countUnsyncedEntries(PROJECT_REF);
            const row = result.rows.item(0);

            expect(row.total_number_of_entries).toBe(4);
            expect(row.total_number_of_entries_with_errors).toBe(1);
            expect(row.total_number_of_entries_unsynced).toBe(2);
        });

        it('countEntriesUnsynced sums unsynced entries and branches', async () => {
            seedEntry(db, { entry_uuid: 'unsynced', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });
            seedBranchEntry(db, { entry_uuid: 'branch', synced: PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR });

            const result = await databaseSelectService.countEntriesUnsynced(PROJECT_REF);

            expect(result.rows.item(0).total).toBe(2);
        });

        it('selectInvalidEntries returns incomplete and errored rows', async () => {
            seedEntry(db, { entry_uuid: 'incomplete', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });
            seedEntry(db, { entry_uuid: 'error', synced: PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR });
            seedEntry(db, { entry_uuid: 'ok', synced: PARAMETERS.SYNCED_CODES.SYNCED });

            const result = await databaseSelectService.selectInvalidEntries('entries', PROJECT_REF);

            expect(rowsToList(result).map((row) => row.entry_uuid).sort()).toEqual(['error', 'incomplete']);
        });

        it('selectParentEntry returns the parent uuid', async () => {
            seedEntry(db, { entry_uuid: 'child', parent_entry_uuid: 'parent' });

            const result = await databaseSelectService.selectParentEntry('child');

            expect(result.rows.item(0).parent_entry_uuid).toBe('parent');
        });

        it('selectChildEntries returns all direct children', async () => {
            seedEntry(db, { entry_uuid: 'child-1', parent_entry_uuid: 'root' });
            seedEntry(db, { entry_uuid: 'child-2', parent_entry_uuid: 'root' });

            const result = await databaseSelectService.selectChildEntries(['root']);

            expect(rowsToList(result).map((row) => row.entry_uuid).sort()).toEqual(['child-1', 'child-2']);
        });

        it('getHierarchyEntries collects child entries and their branch entries', async () => {
            seedEntry(db, { entry_uuid: 'root' });
            seedEntry(db, { entry_uuid: 'child-1', parent_entry_uuid: 'root' });
            seedBranchEntry(db, { entry_uuid: 'branch-c1', owner_entry_uuid: 'child-1' });

            const result = await databaseSelectService.getHierarchyEntries('root');

            expect(result.entries).toEqual(['child-1']);
            expect(result.branchEntries).toEqual(['branch-c1']);
        });
    });

    describe('branch entries', () => {
        it('selectOneBranchEntry returns a branch entry for an owner', async () => {
            seedBranchEntry(db, { entry_uuid: 'branch-1', owner_entry_uuid: 'entry-1' });

            const result = await databaseSelectService.selectOneBranchEntry(PROJECT_REF, 'entry-1', null);

            expect(result.rows.item(0).entry_uuid).toBe('branch-1');
        });

        it('selectOneBranchEntryForExport paginates by owner input ref', async () => {
            seedBranchEntry(db, { entry_uuid: 'b-new', owner_input_ref: 'input', created_at: '2026-01-02T00:00:00.000Z' });
            seedBranchEntry(db, { entry_uuid: 'b-old', owner_input_ref: 'input', created_at: '2026-01-01T00:00:00.000Z' });

            const result = await databaseSelectService.selectOneBranchEntryForExport(PROJECT_REF, 'input', 1);

            expect(result.rows.item(0).entry_uuid).toBe('b-old');
        });

        it('selectBranchEntry reads committed and temporary branch entries', async () => {
            seedBranchEntry(db, { entry_uuid: 'committed' });
            seedTempBranchEntry(db, { entry_uuid: 'temporary' });

            const committed = await databaseSelectService.selectBranchEntry('committed');
            const temporary = await databaseSelectService.selectBranchEntry('temporary');

            expect(committed.rows.item(0).entry_uuid).toBe('committed');
            expect(temporary.rows.item(0).entry_uuid).toBe('temporary');
        });

        it('selectBranchEntries filters and orders', async () => {
            seedBranchEntry(db, { entry_uuid: 'b1', owner_input_ref: 'input', title: 'B1', created_at: '2026-01-01T00:00:00.000Z' });
            seedBranchEntry(db, { entry_uuid: 'b2', owner_input_ref: 'input', title: 'B2', created_at: '2026-01-02T00:00:00.000Z' });

            const result = await databaseSelectService.selectBranchEntries(PROJECT_REF, FORM_REF, 'input', { field: 'created_at', sortType: 'DESC' });

            expect(rowsToList(result).map((row) => row.entry_uuid)).toEqual(['b2', 'b1']);
        });

        it('selectBranches returns entries for multiple owner uuids and bails out on empty input', async () => {
            seedBranchEntry(db, { entry_uuid: 'b1', owner_entry_uuid: 'owner-1' });
            seedBranchEntry(db, { entry_uuid: 'b2', owner_entry_uuid: 'owner-2' });

            const result = await databaseSelectService.selectBranches(['owner-1', 'owner-2']);
            expect(rowsToList(result).map((row) => row.entry_uuid).sort()).toEqual(['b1', 'b2']);

            const empty = await databaseSelectService.selectBranches([]);
            expect(empty.rows.length).toBe(0);
        });

        it('selectTempBranches returns temporary branch uuids for an owner', async () => {
            seedTempBranchEntry(db, { entry_uuid: 'temp-1', owner_entry_uuid: 'owner-1' });

            const result = await databaseSelectService.selectTempBranches('owner-1');

            expect(rowsToList(result).map((row) => row.entry_uuid)).toEqual(['temp-1']);
        });

        it('countUnsyncedBranchEntries counts unsynced branches for an owner', async () => {
            seedBranchEntry(db, { entry_uuid: 'unsynced', owner_entry_uuid: 'owner-1', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });
            seedBranchEntry(db, { entry_uuid: 'synced', owner_entry_uuid: 'owner-1', synced: PARAMETERS.SYNCED_CODES.SYNCED });

            const result = await databaseSelectService.countUnsyncedBranchEntries(PROJECT_REF, 'owner-1');

            expect(result.rows.item(0).count).toBe(1);
        });

        it('selectBranchesForQuestion unions committed and temporary branches with filters', async () => {
            seedBranchEntry(db, { entry_uuid: 'committed', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep' });
            seedTempBranchEntry(db, { entry_uuid: 'temporary', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep' });

            const result = await databaseSelectService.selectBranchesForQuestion('owner-1', 'input', 10, 0, { title: 'Keep' }, null);

            expect(rowsToList(result).map((row) => row.entry_uuid).sort()).toEqual(['committed', 'temporary']);
        });

        it('selectBranchesForQuestion applies title and status across both tables', async () => {
            seedBranchEntry(db, { entry_uuid: 'c-keep', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });
            seedBranchEntry(db, { entry_uuid: 'c-drop', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Drop', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });
            seedBranchEntry(db, { entry_uuid: 'c-synced', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep', synced: PARAMETERS.SYNCED_CODES.SYNCED });
            seedTempBranchEntry(db, { entry_uuid: 't-keep', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });

            const result = await databaseSelectService.selectBranchesForQuestion('owner-1', 'input', null, null, { title: 'Keep' }, PARAMETERS.STATUS.INCOMPLETE);

            expect(rowsToList(result).map((row) => row.entry_uuid).sort()).toEqual(['c-keep', 't-keep']);
        });

        it('selectBranchesForQuestion pages with limit and offset', async () => {
            seedBranchEntry(db, { entry_uuid: 'b1', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', created_at: '2026-01-01T00:00:00.000Z' });
            seedBranchEntry(db, { entry_uuid: 'b2', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', created_at: '2026-01-02T00:00:00.000Z' });
            seedBranchEntry(db, { entry_uuid: 'b3', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', created_at: '2026-01-03T00:00:00.000Z' });

            const result = await databaseSelectService.selectBranchesForQuestion('owner-1', 'input', 2, 1, null, null);

            expect(rowsToList(result).map((row) => row.entry_uuid)).toEqual(['b2', 'b1']);
        });

        it('countBranchesForQuestion counts distinct branches', async () => {
            seedBranchEntry(db, { entry_uuid: 'committed', owner_entry_uuid: 'owner-1', owner_input_ref: 'input' });
            seedTempBranchEntry(db, { entry_uuid: 'temporary', owner_entry_uuid: 'owner-1', owner_input_ref: 'input' });

            const result = await databaseSelectService.countBranchesForQuestion('owner-1', 'input', {}, null);

            expect(result.rows.item(0).total).toBe(2);
        });

        it('countBranchesForQuestion applies the title filter across both tables', async () => {
            seedBranchEntry(db, { entry_uuid: 'c-keep', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep' });
            seedBranchEntry(db, { entry_uuid: 'c-drop', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Drop' });
            seedTempBranchEntry(db, { entry_uuid: 't-keep', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep' });
            seedTempBranchEntry(db, { entry_uuid: 't-drop', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Drop' });

            const result = await databaseSelectService.countBranchesForQuestion('owner-1', 'input', { title: 'Keep' }, null);

            expect(result.rows.item(0).total).toBe(2);
        });

        it('countBranchesForQuestion applies title and status together', async () => {
            seedBranchEntry(db, { entry_uuid: 'c-keep', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });
            seedBranchEntry(db, { entry_uuid: 'c-synced', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep', synced: PARAMETERS.SYNCED_CODES.SYNCED });
            seedTempBranchEntry(db, { entry_uuid: 't-keep', owner_entry_uuid: 'owner-1', owner_input_ref: 'input', title: 'Keep', synced: PARAMETERS.SYNCED_CODES.INCOMPLETE });

            const result = await databaseSelectService.countBranchesForQuestion('owner-1', 'input', { title: 'Keep' }, PARAMETERS.STATUS.INCOMPLETE);

            expect(result.rows.item(0).total).toBe(2);
        });

        it('countAllBranchEntries counts the branch entries of the project', async () => {
            seedBranchEntry(db, { entry_uuid: 'b1' });
            seedBranchEntry(db, { entry_uuid: 'b2' });

            await expect(databaseSelectService.countAllBranchEntries(PROJECT_REF)).resolves.toBe(2);
        });

        it('selectDistinctBranchRefs returns distinct owner input refs', async () => {
            seedBranchEntry(db, { entry_uuid: 'b1', owner_input_ref: 'input-1' });
            seedBranchEntry(db, { entry_uuid: 'b2', owner_input_ref: 'input-1' });
            seedBranchEntry(db, { entry_uuid: 'b3', owner_input_ref: 'input-2' });

            const result = await databaseSelectService.selectDistinctBranchRefs(PROJECT_REF);

            expect(rowsToList(result).map((row) => row.owner_input_ref).sort()).toEqual(['input-1', 'input-2']);
        });

        it('selectDistinctBranchRefsIncludingTemp merges committed and temporary refs', async () => {
            seedBranchEntry(db, { entry_uuid: 'b1', owner_input_ref: 'input-1' });
            seedTempBranchEntry(db, { entry_uuid: 't1', owner_input_ref: 'input-2' });

            const result = await databaseSelectService.selectDistinctBranchRefsIncludingTemp(PROJECT_REF);

            expect(result).toEqual(expect.arrayContaining([
                { formRef: FORM_REF, branchRef: 'input-1' },
                { formRef: FORM_REF, branchRef: 'input-2' }
            ]));
        });
    });

    describe('media', () => {
        it('selectEntryMedia returns the media of an entry with its project ref', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', file_name: 'a.jpg' });
            seedMedia(db, { entry_uuid: 'entry-2', file_name: 'b.jpg' });

            const media = await databaseSelectService.selectEntryMedia(PROJECT_REF, 'entry-1');

            expect(media).toHaveLength(1);
            expect(media[0].file_name).toBe('a.jpg');
            expect(media[0].project_ref).toBe(PROJECT_REF);
        });

        it('selectEntryMediaErrors returns only media with an error, honouring the limit', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', file_name: 'bad.jpg', synced_error: '{"code":"ec5_1"}' });
            seedMedia(db, { entry_uuid: 'entry-1', file_name: 'ok.jpg', synced_error: '' });

            const result = await databaseSelectService.selectEntryMediaErrors(['entry-1'], 1);

            expect(result.rows.length).toBe(1);
            expect(result.rows.item(0).synced_error).toBe('{"code":"ec5_1"}');
        });

        it('selectEntryMediaErrors bails out on an empty uuid list', async () => {
            const result = await databaseSelectService.selectEntryMediaErrors([]);

            expect(result.rows.length).toBe(0);
        });

        it('selectEntryMediaErrorsByForm returns errored media of a form', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', form_ref: FORM_REF, file_name: 'bad.jpg', synced_error: '{"code":"ec5_1"}' });

            const result = await databaseSelectService.selectEntryMediaErrorsByForm(PROJECT_REF, FORM_REF);

            expect(result.rows.length).toBe(1);
            expect(result.rows.item(0).synced_error).toBe('{"code":"ec5_1"}');
        });

        it('countCurrentBranchMediaErrors counts errored media for a branch input ref', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', input_ref: 'branch-input', file_name: 'bad.jpg', synced_error: '{"code":"ec5_1"}' });
            seedMedia(db, { entry_uuid: 'entry-2', input_ref: 'other-input', file_name: 'other.jpg', synced_error: '{"code":"ec5_1"}' });

            const result = await databaseSelectService.countCurrentBranchMediaErrors('branch-input');

            expect(result.rows.item(0).total).toBe(1);
        });

        it('countCurrentBranchMediaErrors matches every input ref with the branch prefix', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', input_ref: 'branch-input', file_name: 'bad.jpg', synced_error: '{"code":"ec5_1"}' });
            seedMedia(db, { entry_uuid: 'entry-2', input_ref: 'branch-input-2', file_name: 'bad2.jpg', synced_error: '{"code":"ec5_1"}' });
            seedMedia(db, { entry_uuid: 'entry-3', input_ref: 'branch-input', file_name: 'ok.jpg', synced_error: '' });

            const result = await databaseSelectService.countCurrentBranchMediaErrors('branch-input');

            expect(result.rows.item(0).total).toBe(2);
        });

        it('countCurrentBranchMediaErrors treats the input ref as data', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', input_ref: 'branch"input', file_name: 'bad.jpg', synced_error: '{"code":"ec5_1"}' });

            const result = await databaseSelectService.countCurrentBranchMediaErrors('branch"input');

            expect(result.rows.item(0).total).toBe(1);
        });

        it('selectProjectMedia groups media by file type', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', input_ref: 'audio-input', file_name: 'a.mp3', file_type: PARAMETERS.QUESTION_TYPES.AUDIO });
            seedMedia(db, { entry_uuid: 'entry-1', input_ref: 'photo-input', file_name: 'p.jpg', file_type: PARAMETERS.QUESTION_TYPES.PHOTO });
            seedMedia(db, { entry_uuid: 'entry-1', input_ref: 'video-input', file_name: 'v.mp4', file_type: PARAMETERS.QUESTION_TYPES.VIDEO });

            const result = await databaseSelectService.selectProjectMedia({ project_ref: PROJECT_REF, synced: null, entry_uuid: null });

            expect(result.audios.map((row) => row.file_name)).toEqual(['a.mp3']);
            expect(result.photos.map((row) => row.file_name)).toEqual(['p.jpg']);
            expect(result.videos.map((row) => row.file_name)).toEqual(['v.mp4']);
        });

        it('selectProjectMedia filters by every given entry uuid', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', file_name: 'a.jpg' });
            seedMedia(db, { entry_uuid: 'entry-2', file_name: 'b.jpg' });
            seedMedia(db, { entry_uuid: 'entry-3', file_name: 'c.jpg' });

            const result = await databaseSelectService.selectProjectMedia({ project_ref: PROJECT_REF, synced: null, entry_uuid: ['entry-1', 'entry-2'] });

            expect(result.photos.map((row) => row.file_name)).toEqual(['a.jpg', 'b.jpg']);
        });

        it('selectMediaBeforeDownload returns media of remote entries and synced branches', async () => {
            seedEntry(db, { entry_uuid: 'remote-1', form_ref: 'form-a', is_remote: PARAMETERS.REMOTE_CODES.IS });
            seedEntry(db, { entry_uuid: 'local-1', form_ref: 'form-a', is_remote: PARAMETERS.REMOTE_CODES.ISNT });
            seedBranchEntry(db, { entry_uuid: 'branch-synced', form_ref: 'form-a', synced: PARAMETERS.SYNCED_CODES.SYNCED });
            seedMedia(db, { entry_uuid: 'remote-1', form_ref: 'form-a', file_name: 'remote.jpg' });
            seedMedia(db, { entry_uuid: 'local-1', form_ref: 'form-a', file_name: 'local.jpg' });
            seedMedia(db, { entry_uuid: 'branch-synced', form_ref: 'form-a', file_name: 'branch.jpg' });

            const media = await databaseSelectService.selectMediaBeforeDownload(PROJECT_REF, ['form-a']);

            expect(media.map((row) => row.file_name).sort()).toEqual(['branch.jpg', 'remote.jpg']);
        });

        it('countMediaUnsynced and countAllMedia count media rows', async () => {
            seedMedia(db, { entry_uuid: 'entry-1', file_name: 'unsynced.jpg', synced: PARAMETERS.SYNCED_CODES.UNSYNCED });
            seedMedia(db, { entry_uuid: 'entry-1', file_name: 'synced.jpg', synced: PARAMETERS.SYNCED_CODES.SYNCED });

            const unsynced = await databaseSelectService.countMediaUnsynced(PROJECT_REF);

            expect(unsynced.rows.item(0).total).toBe(1);
            await expect(databaseSelectService.countAllMedia(PROJECT_REF)).resolves.toBe(2);
        });
    });

    describe('uniqueness, saved answers and bookmarks', () => {
        it('isUnique finds a duplicate answer for another entry', async () => {
            seedUniqueAnswer(db, { entry_uuid: 'entry-other', input_ref: 'unique-input', answer: 'taken' });

            const result = await databaseSelectService.isUnique(
                { entryUuid: 'entry-new' },
                { type: PARAMETERS.QUESTION_TYPES.TEXT, ref: 'unique-input', uniqueness: 'form' },
                'taken'
            );

            expect(result.rows.length).toBe(1);
        });

        it('isUnique scopes hierarchy uniqueness by parent entry', async () => {
            seedUniqueAnswer(db, { entry_uuid: 'entry-other', input_ref: 'unique-input', answer: 'taken', parent_entry_uuid: 'parent-1' });

            const result = await databaseSelectService.isUnique(
                { entryUuid: 'entry-new', parentEntryUuid: 'parent-1' },
                { type: PARAMETERS.QUESTION_TYPES.TEXT, ref: 'unique-input', uniqueness: 'hierarchy' },
                'taken'
            );

            expect(result.rows.length).toBe(1);
        });

        it('isUnique scopes branch uniqueness by owner entry', async () => {
            seedUniqueAnswer(db, { entry_uuid: 'entry-other', input_ref: 'unique-input', answer: 'taken', owner_entry_uuid: 'owner-1' });

            const result = await databaseSelectService.isUnique(
                { entryUuid: 'entry-new', ownerEntryUuid: 'owner-1' },
                { type: PARAMETERS.QUESTION_TYPES.TEXT, ref: 'unique-input', uniqueness: 'form' },
                'taken'
            );

            expect(result.rows.length).toBe(1);
        });

        it('getSavedAnswers returns stored answers for a form', async () => {
            seedEntry(db, { entry_uuid: 'entry-1', form_ref: FORM_REF, answers: '{"q1":"a1"}' });

            const result = await databaseSelectService.getSavedAnswers(PROJECT_REF, FORM_REF, false, 0);

            expect(result.rows.item(0).answers).toBe('{"q1":"a1"}');
        });

        it('selectBookmarks returns stored bookmarks', async () => {
            seedBookmark(db, { title: 'Bookmark' });

            const result = await databaseSelectService.selectBookmarks();

            expect(result.rows.item(0).title).toBe('Bookmark');
        });

        it('selectDistinctFormRefs collects form refs across tables', async () => {
            seedEntry(db, { entry_uuid: 'entry-a', form_ref: 'form-a' });
            seedBranchEntry(db, { entry_uuid: 'branch-b', form_ref: 'form-b' });

            const formRefs = await databaseSelectService.selectDistinctFormRefs(PROJECT_REF);

            expect(formRefs.sort()).toEqual(['form-a', 'form-b']);
        });
    });

    describe('LIKE filters bind values instead of interpolating them', () => {
        it('selectEntries matches an apostrophe title literally', async () => {
            seedEntry(db, { entry_uuid: 'target', form_ref: FORM_REF, title: 'd\'cure' });
            seedEntry(db, { entry_uuid: 'decoy', form_ref: FORM_REF, title: 'cure' });

            const result = await databaseSelectService.selectEntries(PROJECT_REF, FORM_REF, '', null, null, null, { title: 'd\'cure' }, null);

            expect(rowsToList(result).map((row) => row.entry_uuid)).toEqual(['target']);
        });

        it('countEntries escapes LIKE wildcards so they match literally', async () => {
            seedEntry(db, { entry_uuid: 'target', form_ref: FORM_REF, title: '100%' });
            seedEntry(db, { entry_uuid: 'decoy', form_ref: FORM_REF, title: '1000' });

            const result = await databaseSelectService.countEntries(PROJECT_REF, FORM_REF, '', { title: '100%' }, null);

            expect(result.rows.item(0).total).toBe(1);
        });

        it('selectEntries matches an underscore literally', async () => {
            seedEntry(db, { entry_uuid: 'target', form_ref: FORM_REF, title: 'a_b' });
            seedEntry(db, { entry_uuid: 'decoy', form_ref: FORM_REF, title: 'axb' });

            const result = await databaseSelectService.selectEntries(PROJECT_REF, FORM_REF, '', null, null, null, { title: 'a_b' }, null);

            expect(rowsToList(result).map((row) => row.entry_uuid)).toEqual(['target']);
        });

        it('selectEntries matches a backslash literally', async () => {
            seedEntry(db, { entry_uuid: 'target', form_ref: FORM_REF, title: 'a\\b' });
            seedEntry(db, { entry_uuid: 'decoy', form_ref: FORM_REF, title: 'ab' });

            const result = await databaseSelectService.selectEntries(PROJECT_REF, FORM_REF, '', null, null, null, { title: 'a\\b' }, null);

            expect(rowsToList(result).map((row) => row.entry_uuid)).toEqual(['target']);
        });

        it('treats a hostile title as data and returns nothing', async () => {
            seedEntry(db, { entry_uuid: 'decoy', form_ref: FORM_REF, title: 'anything' });

            const result = await databaseSelectService.countEntries(PROJECT_REF, FORM_REF, '', { title: '%" OR 1=1 --' }, null);

            expect(result.rows.item(0).total).toBe(0);
        });
    });
});
