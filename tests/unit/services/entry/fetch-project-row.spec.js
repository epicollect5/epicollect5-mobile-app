import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        selectProject: vi.fn()
    }
}));

import { fetchProjectRow } from '@/use/project/fetch-project-row';
import { databaseSelectService } from '@/services/database/database-select-service';

describe('fetch-project-row', () => {
    it('returns the row when present', async () => {
        databaseSelectService.selectProject.mockResolvedValue({
            rows: { length: 1, item: () => ({ project_ref: 'p1' }) }
        });

        const row = await fetchProjectRow('p1');

        expect(row.project_ref).toBe('p1');
    });

    it('throws PROJECT_MISSING on empty rows without touching item(0)', async () => {
        const item = vi.fn();
        databaseSelectService.selectProject.mockResolvedValue({
            rows: { length: 0, item }
        });

        await expect(fetchProjectRow('gone')).rejects.toMatchObject({ code: 'PROJECT_MISSING' });
        expect(item).not.toHaveBeenCalled();
    });
});
