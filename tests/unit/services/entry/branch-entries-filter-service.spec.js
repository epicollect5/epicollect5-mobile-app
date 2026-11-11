import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        countBranchesForQuestion: vi.fn()
    }
}));

import { branchEntriesFilterService } from '@/services/entry/branch-entries-filter-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { PARAMETERS } from '@/config';

function rows(items) {
    return {
        rows: {
            length: items.length,
            item: (index) => items[index]
        }
    };
}

describe('branch-entries-filter-service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps countNoFilters unfiltered while seeding active filters', async () => {
        databaseSelectService.countBranchesForQuestion
            .mockResolvedValueOnce(rows([{ total: 50 }]))
            .mockResolvedValueOnce(rows([{ total: 6, oldest: '2024-01-02T10:00:00.000Z', newest: '2024-03-04T10:00:00.000Z' }]));

        const active = { title: '', from: null, to: null, oldest: null, newest: null, status: 'ALL' };
        const result = await branchEntriesFilterService.getBranchFilterCounts('owner-1', 'input-ref-1', active);

        expect(result.countNoFilters).toBe(50);
        expect(result.countWithFilters).toBe(6);
        expect(result.filters.oldest).toBe('2024-01-02');
        expect(result.filters.newest).toBe('2024-03-04');
        expect(result.filters.from).toBe('2024-01-02');
        expect(result.filters.to).toBe('2024-03-04');
        const firstCallFilters = databaseSelectService.countBranchesForQuestion.mock.calls[0][2];
        expect(firstCallFilters).toMatchObject({ title: '' });
        expect(firstCallFilters.from).toBe(null);
    });

    it('resets countWithFilters to 0 when no entries match', async () => {
        databaseSelectService.countBranchesForQuestion
            .mockResolvedValueOnce(rows([{ total: 0 }]))
            .mockResolvedValueOnce(rows([{ total: 0, oldest: null, newest: null }]));

        const result = await branchEntriesFilterService.getBranchFilterCounts('owner-1', 'input-ref-1', { ...PARAMETERS.FILTERS_DEFAULT });

        expect(result.countWithFilters).toBe(0);
    });
});
