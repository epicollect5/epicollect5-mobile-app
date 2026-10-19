import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabaseService } from '@/services/database/database-create-service';
import { MIGRATIONS } from '@/config';
import { createFreshDb } from '@/helpers/db-test-setup';

const TABLES = [
    'projects',
    'users',
    'entries',
    'branch_entries',
    'temp_branch_entries',
    'media',
    'unique_answers',
    'temp_unique_answers',
    'bookmarks',
    'settings'
];

function tableNames(db) {
    return db.query('SELECT name FROM sqlite_master WHERE type = \'table\'').map((row) => row.name);
}

function columns(db, table) {
    return db.query('PRAGMA table_info(' + table + ')').map((row) => row.name);
}

describe('createDatabaseService.execute', () => {
    let db;

    beforeEach(async () => {
        db = await createFreshDb();
    });

    it('creates every table', async () => {
        await createDatabaseService.execute(db);

        expect(tableNames(db)).toEqual(expect.arrayContaining(TABLES));
    });

    it('creates the expected columns on each table', async () => {
        await createDatabaseService.execute(db);

        expect(columns(db, 'entries')).toEqual(expect.arrayContaining([
            'entry_uuid', 'parent_entry_uuid', 'project_ref', 'form_ref', 'parent_form_ref',
            'answers', 'created_at', 'updated_at', 'title', 'synced', 'synced_error',
            'can_edit', 'is_remote'
        ]));
        expect(columns(db, 'branch_entries')).toEqual(expect.arrayContaining([
            'entry_uuid', 'owner_entry_uuid', 'owner_input_ref', 'project_ref', 'form_ref',
            'answers', 'synced', 'synced_error', 'can_edit', 'is_remote'
        ]));
        expect(columns(db, 'media')).toEqual(expect.arrayContaining([
            'entry_uuid', 'branch_entry_uuid', 'input_ref', 'project_ref', 'form_ref',
            'file_name', 'file_path', 'file_type', 'synced', 'synced_error'
        ]));
    });

    it('seeds the db version in the settings table', async () => {
        await createDatabaseService.execute(db);

        const rows = db.query('SELECT value FROM settings WHERE field = ?', [MIGRATIONS.dbVersionName]);

        expect(rows).toHaveLength(1);
        expect(String(rows[0].value)).toBe(String(MIGRATIONS.dbVersion));
    });

    it('is idempotent and keeps the seeded version on a second run', async () => {
        await createDatabaseService.execute(db);
        await createDatabaseService.execute(db);

        const rows = db.query('SELECT value FROM settings WHERE field = ?', [MIGRATIONS.dbVersionName]);

        expect(rows).toHaveLength(1);
        expect(window.localStorage.is_app_already_installed).toBe('1');
    });
});
