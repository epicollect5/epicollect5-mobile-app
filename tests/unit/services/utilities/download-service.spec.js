import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import flushPromises from 'flush-promises';
import { downloadService } from '@/services/utilities/download-service';
import { webService } from '@/services/web-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { notificationService } from '@/services/notification-service';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en'
    }))
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            status_codes: {
                ec5_116: 'Server error'
            }
        }
    }
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getSlug: vi.fn(() => 'project-slug'),
        getProjectRef: vi.fn(() => 'project-ref')
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        EDIT_CODES: {
            CANT: 0
        },
        REMOTE_CODES: {
            IS: 1
        },
        SYNCED_CODES: {
            SYNCED: 1
        }
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        setProgressTransfer: vi.fn()
    }
}));

vi.mock('@/services/utilities/json-transformer-service', () => ({
    JSONTransformerService: {
        flattenJsonEntry: vi.fn((entry, canEdit, isRemote) => ({
            entryUuid: entry.uuid,
            parentEntryUuid: '',
            formRef: 'form-ref',
            parentFormRef: '',
            answers: entry.answers || {},
            canEdit,
            isRemote,
            createdAt: entry.created_at,
            updatedAt: entry.updated_at,
            title: entry.title || entry.uuid
        }))
    }
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: {
        insertEntries: vi.fn(() => Promise.resolve())
    }
}));

vi.mock('@/services/web-service', () => ({
    webService: {
        downloadEntries: vi.fn()
    }
}));

function makeResponse(url, entries, nextUrl, total) {
    return {
        config: { url },
        data: {
            data: {
                entries
            },
            links: {
                next: nextUrl
            },
            meta: {
                total
            }
        }
    };
}

describe('downloadService.downloadFormEntries', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('throttles consecutive page requests and bulk-inserts each page once', async () => {
        webService.downloadEntries
            .mockResolvedValueOnce(makeResponse('page-1', [{ uuid: 'entry-1' }], 'page-2', 2))
            .mockResolvedValueOnce(makeResponse('page-2', [{ uuid: 'entry-2' }], null, 2));

        const downloadPromise = downloadService.downloadFormEntries('form-ref', {
            delayMs: 2000
        });

        await flushPromises();

        expect(webService.downloadEntries).toHaveBeenCalledTimes(1);
        expect(webService.downloadEntries).toHaveBeenNthCalledWith(1, 'project-slug', 'form-ref', undefined);
        expect(databaseInsertService.insertEntries).toHaveBeenCalledTimes(1);
        expect(databaseInsertService.insertEntries.mock.calls[0][0]).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(1999);
        expect(webService.downloadEntries).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        await downloadPromise;

        expect(webService.downloadEntries).toHaveBeenCalledTimes(2);
        expect(webService.downloadEntries).toHaveBeenNthCalledWith(2, 'project-slug', 'form-ref', 'page-2');
        expect(databaseInsertService.insertEntries).toHaveBeenCalledTimes(2);
        expect(notificationService.setProgressTransfer).toHaveBeenLastCalledWith({ total: 2, done: 2 });
    });

    it('skips cached URLs when resuming and starts at the first unfinished URL', async () => {
        webService.downloadEntries.mockResolvedValueOnce(makeResponse('page-2', [{ uuid: 'entry-2' }], null, 2));

        const hasEntries = await downloadService.downloadFormEntries('form-ref', {
            startUrl: 'page-1',
            initialTotalEntries: 2,
            initialEntryNumber: 1,
            shouldSkipUrl: (url) => url === 'page-1',
            getCachedNextUrl: () => 'page-2'
        });

        expect(hasEntries).toBe(true);
        expect(webService.downloadEntries).toHaveBeenCalledTimes(1);
        expect(webService.downloadEntries).toHaveBeenCalledWith('project-slug', 'form-ref', 'page-2');
        expect(notificationService.setProgressTransfer).toHaveBeenLastCalledWith({ total: 2, done: 2 });
    });

    it('reports persisted progress before and after a page is stored', async () => {
        const onProgress = vi.fn();
        const onPageDownloaded = vi.fn();

        webService.downloadEntries.mockResolvedValueOnce(makeResponse('page-2', [{ uuid: 'entry-2' }], null, 5));

        await downloadService.downloadFormEntries('form-ref', {
            startUrl: 'page-2',
            initialTotalEntries: 5,
            initialEntryNumber: 1,
            onProgress,
            onPageDownloaded
        });

        expect(onProgress).toHaveBeenCalledWith({
            totalEntries: 5,
            processedEntries: 1
        });
        expect(onPageDownloaded).toHaveBeenCalledWith('page-2', null, {
            totalEntries: 5,
            processedEntries: 2
        });
    });

    it('does not mark a page as downloaded when the request fails', async () => {
        const onPageDownloaded = vi.fn();
        const error = { status: 429 };

        webService.downloadEntries.mockRejectedValueOnce(error);

        await expect(downloadService.downloadFormEntries('form-ref', {
            onPageDownloaded
        })).rejects.toBe(error);

        expect(databaseInsertService.insertEntries).not.toHaveBeenCalled();
        expect(onPageDownloaded).not.toHaveBeenCalled();
    });

    it('stops before the next request when cancelled during the throttle delay', async () => {
        let cancelled = false;

        webService.downloadEntries
            .mockResolvedValueOnce(makeResponse('page-1', [{ uuid: 'entry-1' }], 'page-2', 2));

        const downloadPromise = downloadService.downloadFormEntries('form-ref', {
            delayMs: 2000,
            isCancelled: () => cancelled
        });

        await flushPromises();
        expect(webService.downloadEntries).toHaveBeenCalledTimes(1);

        const cancellationExpectation = expect(downloadPromise).rejects.toMatchObject({
            cancelled: true
        });
        cancelled = true;
        await vi.advanceTimersByTimeAsync(100);

        await cancellationExpectation;
        expect(webService.downloadEntries).toHaveBeenCalledTimes(1);
    });
});
