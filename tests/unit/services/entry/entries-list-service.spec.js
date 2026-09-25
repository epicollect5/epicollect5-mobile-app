import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        countEntries: vi.fn()
    }
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getExtraForm: vi.fn(),
        getFirstFormRef: vi.fn(),
        getNextFormRef: vi.fn(),
        getParentFormRef: vi.fn(),
        getFormName: vi.fn()
    }
}));

import { entriesListService } from '@/services/entry/entries-list-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';

function rows(items) {
    return {
        rows: {
            length: items.length,
            item: (index) => items[index]
        }
    };
}

describe('entries-list-service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps countNoFilters unfiltered while seeding active filters', async () => {
        databaseSelectService.countEntries
            .mockResolvedValueOnce(rows([{ total: 50 }]))
            .mockResolvedValueOnce(rows([{ total: 6, oldest: '2024-01-02T10:00:00.000Z', newest: '2024-03-04T10:00:00.000Z' }]));

        const active = { title: '', from: null, to: null, oldest: null, newest: null, status: 'ALL' };
        const result = await entriesListService.getFilterCounts('p1', 'f1', '', active);

        expect(result.countNoFilters).toBe(50);
        expect(result.countWithFilters).toBe(6);
        expect(result.filters.oldest).toBe('2024-01-02');
        expect(result.filters.to).toBe('2024-03-04');
        const firstCallFilters = databaseSelectService.countEntries.mock.calls[0][3];
        expect(firstCallFilters).toMatchObject({ title: '' });
        expect(firstCallFilters.from).toBe(null);
    });

    it('resets countWithFilters to 0 when no entries match', async () => {
        databaseSelectService.countEntries
            .mockResolvedValueOnce(rows([{ total: 0 }]))
            .mockResolvedValueOnce(rows([{ total: 0, oldest: null, newest: null }]));

        const result = await entriesListService.getFilterCounts('p1', 'f1', '', { ...PARAMETERS.FILTERS_DEFAULT });

        expect(result.countWithFilters).toBe(0);
    });

    it('resolves form context without touching stores', () => {
        projectModel.getExtraForm.mockReturnValue({ details: { name: 'Form 1' } });
        projectModel.getNextFormRef.mockReturnValue('');
        projectModel.getParentFormRef.mockReturnValue('');
        projectModel.getFormName.mockReturnValue('');

        const context = entriesListService.setActiveForm({
            projectRef: 'p1',
            formRef: 'f1',
            hierarchyNavigation: [],
            language: 'en',
            bookmarks: [{ id: 7, projectRef: 'p1', formRef: 'f1', hierarchyNavigation: [] }]
        });

        expect(context.formRef).toBe('f1');
        expect(context.bookmarkId).toBe(7);
        expect(context.parentFormRef).toBe('');
    });

    it('falls back to first form and flags hierarchy reset', () => {
        projectModel.getExtraForm.mockImplementation((ref) => {
            if (ref === 'missing') {
                return {};
            }
            return { details: { name: 'First' } };
        });
        projectModel.getFirstFormRef.mockReturnValue('first');
        projectModel.getNextFormRef.mockReturnValue('');
        projectModel.getParentFormRef.mockReturnValue('');
        projectModel.getFormName.mockReturnValue('');

        const context = entriesListService.setActiveForm({
            projectRef: 'p1',
            formRef: 'missing',
            hierarchyNavigation: [],
            language: 'en',
            bookmarks: []
        });

        expect(context.formRef).toBe('first');
        expect(context.resetHierarchy).toBe(true);
    });
});
