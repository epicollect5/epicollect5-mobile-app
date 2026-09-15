import { describe, it, expect, beforeEach, vi } from 'vitest';
import { databaseSelectService } from '@/services/database/database-select-service';
import { PARAMETERS } from '@/config';

vi.mock('@/stores/db-store', () => ({
    useDBStore: vi.fn()
}));

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({}))
}));

describe('databaseSelectService title filter binding', () => {
    let captured;

    beforeEach(() => {
        vi.clearAllMocks();
        captured = {};
        vi.spyOn(databaseSelectService, 'getRows').mockImplementation(async (query, params) => {
            captured.query = query;
            captured.params = params;
            return { rows: { length: 0 } };
        });
    });

    it('selectEntries binds apostrophe titles instead of interpolating', async () => {
        await databaseSelectService.selectEntries(
            'project-ref',
            'form-ref',
            '',
            null,
            null,
            null,
            { title: 'd\'cure' },
            null
        );

        expect(captured.query).toContain('title LIKE ?');
        expect(captured.query).not.toContain('d\'cure');
        expect(captured.params).toContain('%d\'cure%');
    });

    it('countEntries binds D\' title from the Rollbar trace', async () => {
        await databaseSelectService.countEntries(
            'project-ref',
            'form-ref',
            '',
            { title: 'D\'' },
            null
        );

        expect(captured.query).toContain('title LIKE ?');
        expect(captured.query).not.toContain('%D\'%');
        expect(captured.params).toContain('%D\'%');
    });

    it('binds a trailing-apostrophe title from the Rollbar trace', async () => {
        await databaseSelectService.countEntries(
            'project-ref',
            'form-ref',
            '',
            { title: 'Brother\'s' },
            null
        );

        expect(captured.query).toContain('title LIKE ?');
        expect(captured.query).not.toContain('Brother\'s');
        expect(captured.params).toContain('%Brother\'s%');
    });

    it('binds an apostrophe title combined with a status filter', async () => {
        await databaseSelectService.countEntries(
            'project-ref',
            'form-ref',
            '',
            { title: 'D\'Hello ' },
            PARAMETERS.STATUS.INCOMPLETE
        );

        expect(captured.query).toContain('title LIKE ?');
        expect(captured.query).toContain('synced= ?');
        expect(captured.query).not.toContain('D\'Hello');
        expect(captured.params).toContain('%D\'Hello %');
        expect(captured.params).toContain(PARAMETERS.SYNCED_CODES.INCOMPLETE);
        //title placeholder precedes the synced placeholder
        expect(captured.params.indexOf('%D\'Hello %')).toBeLessThan(
            captured.params.indexOf(PARAMETERS.SYNCED_CODES.INCOMPLETE)
        );
    });

    it('escapes LIKE wildcards so they match literally', async () => {
        await databaseSelectService.countEntries(
            'project-ref',
            'form-ref',
            '',
            { title: '100%_x\\y' },
            null
        );

        expect(captured.query).toContain('ESCAPE');
        expect(captured.params).toContain('%100\\%\\_x\\\\y%');
    });

    it('keeps normal titles working', async () => {
        await databaseSelectService.selectEntries(
            'project-ref',
            'form-ref',
            '',
            null,
            null,
            null,
            { title: 'cure' },
            null
        );

        expect(captured.params).toContain('%cure%');
    });

    it('binds double quotes and backticks as plain data', async () => {
        await databaseSelectService.countEntries(
            'project-ref',
            'form-ref',
            '',
            { title: 'say "hi" `there`' },
            null
        );

        expect(captured.query).toContain('title LIKE ?');
        expect(captured.query).not.toContain('say "hi"');
        expect(captured.params).toContain('%say "hi" `there`%');
    });

    it('binds a combined hostile string without breaking the query', async () => {
        const hostile = 'd\'cure "x" `y` 100%_\\';
        await databaseSelectService.selectEntries(
            'project-ref',
            'form-ref',
            '',
            null,
            null,
            null,
            { title: hostile },
            null
        );

        expect(captured.query).toContain('title LIKE ?');
        expect(captured.query).not.toContain(hostile);
        expect(captured.params).toContain('%d\'cure "x" `y` 100\\%\\_\\\\%');
    });

    it('binds punctuation (, . ; : ( ) - + # etc.) as plain data', async () => {
        const punctuation = 'a,b.c;d:e(f)g-h+i#j*k?l[m]n!o/p=q<r>s';
        await databaseSelectService.countEntries(
            'project-ref',
            'form-ref',
            '',
            { title: punctuation },
            null
        );

        expect(captured.query).toContain('title LIKE ?');
        expect(captured.query).not.toContain(punctuation);
        expect(captured.params).toContain('%' + punctuation + '%');
    });

    it('omits the LIKE clause when no title filter is set', async () => {
        await databaseSelectService.countEntries(
            'project-ref',
            'form-ref',
            '',
            {},
            null
        );

        expect(captured.query).not.toContain('LIKE');
    });

    it('selectBranchesForQuestion binds both UNION title params in order', async () => {
        await databaseSelectService.selectBranchesForQuestion(
            'owner-uuid',
            'input-ref',
            25,
            0,
            { title: 'O\'Brien' },
            null
        );

        const likeCount = (captured.query.match(/title LIKE \?/g) || []).length;
        expect(likeCount).toBe(2);
        expect(captured.query).not.toContain('O\'Brien');
        expect(captured.params.slice(0, 4)).toEqual(['owner-uuid', 'input-ref', 'owner-uuid', 'input-ref']);
        expect(captured.params[4]).toBe('%O\'Brien%');
        expect(captured.params[5]).toBe('%O\'Brien%');
        expect(captured.params[6]).toBe(25);
    });

    it('countBranchesForQuestion binds both UNION title params', async () => {
        await databaseSelectService.countBranchesForQuestion(
            'owner-uuid',
            'input-ref',
            { title: 'd\'cure' },
            null
        );

        const likeCount = (captured.query.match(/title LIKE \?/g) || []).length;
        expect(likeCount).toBe(2);
        expect(captured.query).not.toContain('d\'cure');
        expect(captured.params).toContain('%d\'cure%');
    });
});
