import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabaseService } from '@/services/database/database-create-service';
import { databaseMigrateService } from '@/services/database/database-migrate-service';
import { MIGRATIONS } from '@/config';
import { createFreshDb } from '@/helpers/db-test-setup';

function columns(db, table) {
    return db.query('PRAGMA table_info(' + table + ')').map((row) => row.name);
}

function dbVersion(db) {
    const rows = db.query('SELECT value FROM settings WHERE field = ?', [MIGRATIONS.dbVersionName]);
    return rows.length ? rows[0].value : null;
}

describe('databaseMigrateService.execute', () => {
    let db;

    beforeEach(async () => {
        db = await createFreshDb();
        await createDatabaseService.execute(db);
    });

    it('adds the columns introduced after v1', async () => {
        await databaseMigrateService.execute(1);

        expect(columns(db, 'unique_answers')).toContain('form_ref');
        expect(columns(db, 'temp_unique_answers')).toContain('form_ref');
        expect(columns(db, 'users')).toEqual(expect.arrayContaining(['name', 'email']));
        expect(columns(db, 'projects')).toContain('mapping');
    });

    it('reports and stores version 5 after migrating from v1', async () => {
        const version = await databaseMigrateService.execute(1);

        expect(version).toBe(5);
        expect(String(dbVersion(db))).toBe('5');
    });

    it('is a no-op when already at the latest version', async () => {
        await databaseMigrateService.execute(1);
        const version = await databaseMigrateService.execute(5);

        expect(version).toBe(5);
        expect(String(dbVersion(db))).toBe('5');
        expect(columns(db, 'projects')).toContain('mapping');
    });
});
