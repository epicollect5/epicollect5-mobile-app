import { PARAMETERS } from '@/config';
import { databaseSelectService } from '@/services/database/database-select-service';

export const branchEntriesFilterService = {

    async getBranchFilterCounts(ownerEntryUuid, ownerInputRef, activeFilters) {
        // Clone: date seeding below must not leak into the caller's object.
        const workingFilters = { ...activeFilters };

        // COUNT(*) always returns exactly one row: trust the query contract.
        const resultWithoutFilters = await databaseSelectService.countBranchesForQuestion(
            ownerEntryUuid,
            ownerInputRef,
            { ...PARAMETERS.FILTERS_DEFAULT },
            PARAMETERS.STATUS.ALL
        );
        const countNoFilters = resultWithoutFilters.rows.item(0).total;

        const result = await databaseSelectService.countBranchesForQuestion(
            ownerEntryUuid,
            ownerInputRef,
            workingFilters,
            workingFilters.status
        );

        const total = result.rows.item(0).total;
        if (total > 0) {
            const oldestDateISO = result.rows.item(0).oldest.split('T')[0];
            const newestDateISO = result.rows.item(0).newest.split('T')[0];
            // Seed the date bounds once so the toolbar can reset them later.
            if (workingFilters.oldest === null && workingFilters.newest === null) {
                workingFilters.oldest = oldestDateISO;
                workingFilters.newest = newestDateISO;
                workingFilters.from = oldestDateISO;
                workingFilters.to = newestDateISO;
            }
        }

        return {
            countNoFilters,
            countWithFilters: total,
            filters: workingFilters
        };
    }
};
