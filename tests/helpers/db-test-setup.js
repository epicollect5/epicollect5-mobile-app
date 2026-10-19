import { createPinia, setActivePinia } from 'pinia';
import { useDBStore } from '@/stores/db-store';
import { createDatabaseService } from '@/services/database/database-create-service';
import { databaseMigrateService } from '@/services/database/database-migrate-service';
import { createSqliteHarness } from '@/helpers/sqlite-harness';

/**
 * Give the current test a fresh in-memory SQLite database installed on the real
 * Pinia db-store, with no schema yet.
 */
export async function createFreshDb() {
    setActivePinia(createPinia());
    const dbStore = useDBStore();

    const { db } = await createSqliteHarness();
    dbStore.db = db;

    return db;
}

/**
 * Fresh database built from the real create + migrate services (v1 -> v5), so
 * the full production schema is available and every query can run for real.
 */
export async function setupDbTest() {
    const db = await createFreshDb();

    await createDatabaseService.execute(db);
    useDBStore().dbVersion = await databaseMigrateService.execute(1);

    return db;
}
