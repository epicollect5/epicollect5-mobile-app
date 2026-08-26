import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import flushPromises from 'flush-promises';
import { downloadService } from '@/services/utilities/download-service';
import { webService } from '@/services/web-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { notificationService } from '@/services/notification-service';
import { PARAMETERS } from '@/config';

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
        },
        DEBUG: 1
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
        PARAMETERS.DEBUG = 1;
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

    it('normalizes same-host next links to https when the current request is https', async () => {
        const onPageDownloaded = vi.fn();

        webService.downloadEntries
            .mockResolvedValueOnce(makeResponse('https://example.com/api/entries?page=1', [{ uuid: 'entry-1' }], 'http://example.com/api/entries?page=2', 2))
            .mockResolvedValueOnce(makeResponse('https://example.com/api/entries?page=2', [{ uuid: 'entry-2' }], null, 2));

        const downloadPromise = downloadService.downloadFormEntries('form-ref', {
            delayMs: 2000,
            startUrl: 'https://example.com/api/entries?page=1',
            onPageDownloaded
        });

        await flushPromises();
        await vi.advanceTimersByTimeAsync(2000);
        await downloadPromise;

        expect(onPageDownloaded).toHaveBeenNthCalledWith(1, 'https://example.com/api/entries?page=1', 'https://example.com/api/entries?page=2', {
            totalEntries: 2,
            processedEntries: 1
        });
        expect(webService.downloadEntries).toHaveBeenNthCalledWith(2, 'project-slug', 'form-ref', 'https://example.com/api/entries?page=2');
    });

    it('normalizes cached same-host next links to https when resuming from an https URL', async () => {
        webService.downloadEntries.mockResolvedValueOnce(makeResponse('https://example.com/api/entries?page=2', [{ uuid: 'entry-2' }], null, 2));

        await downloadService.downloadFormEntries('form-ref', {
            startUrl: 'https://example.com/api/entries?page=1',
            initialTotalEntries: 2,
            initialEntryNumber: 1,
            shouldSkipUrl: (url) => url === 'https://example.com/api/entries?page=1',
            getCachedNextUrl: () => 'http://example.com/api/entries?page=2'
        });

        expect(webService.downloadEntries).toHaveBeenCalledWith('project-slug', 'form-ref', 'https://example.com/api/entries?page=2');
    });

    it('does not normalize next links when debug mode is disabled', async () => {
        PARAMETERS.DEBUG = 0;

        webService.downloadEntries
            .mockResolvedValueOnce(makeResponse('https://example.com/api/entries?page=1', [{ uuid: 'entry-1' }], 'http://example.com/api/entries?page=2', 2))
            .mockResolvedValueOnce(makeResponse('http://example.com/api/entries?page=2', [{ uuid: 'entry-2' }], null, 2));

        const downloadPromise = downloadService.downloadFormEntries('form-ref', {
            delayMs: 2000,
            startUrl: 'https://example.com/api/entries?page=1'
        });

        await flushPromises();
        await vi.advanceTimersByTimeAsync(2000);
        await downloadPromise;

        expect(webService.downloadEntries).toHaveBeenNthCalledWith(2, 'project-slug', 'form-ref', 'http://example.com/api/entries?page=2');
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

    it('returns true when earlier pages had entries and the last page is empty', async () => {
        webService.downloadEntries
            .mockResolvedValueOnce(makeResponse('page-1', [{ uuid: 'entry-1' }], 'page-2', 1))
            .mockResolvedValueOnce(makeResponse('page-2', [], null, 1));

        const downloadPromise = downloadService.downloadFormEntries('form-ref', {
            delayMs: 2000
        });

        await flushPromises();
        await vi.advanceTimersByTimeAsync(2000);

        await expect(downloadPromise).resolves.toBe(true);
        expect(databaseInsertService.insertEntries).toHaveBeenCalledTimes(1);
    });

    it('does not re-download a cached terminal URL when resuming completed progress', async () => {
        const hasEntries = await downloadService.downloadFormEntries('form-ref', {
            startUrl: 'page-1',
            initialTotalEntries: 1,
            initialEntryNumber: 1,
            shouldSkipUrl: (url) => url === 'page-1',
            getCachedNextUrl: () => null
        });

        expect(hasEntries).toBe(true);
        expect(webService.downloadEntries).not.toHaveBeenCalled();
        expect(databaseInsertService.insertEntries).not.toHaveBeenCalled();
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

    it('aborts before the next request when the version check fails mid-download', async () => {
        let versionChanged = false;
        const abortReason = { versionChanged: true };

        webService.downloadEntries
            .mockResolvedValueOnce(makeResponse('page-1', [{ uuid: 'entry-1' }], 'page-2', 2));

        const downloadPromise = downloadService.downloadFormEntries('form-ref', {
            delayMs: 2000,
            shouldAbort: async () => (versionChanged ? abortReason : null)
        });

        await flushPromises();
        expect(webService.downloadEntries).toHaveBeenCalledTimes(1);
        expect(databaseInsertService.insertEntries).toHaveBeenCalledTimes(1);

        const abortExpectation = expect(downloadPromise).rejects.toBe(abortReason);
        versionChanged = true;
        await vi.advanceTimersByTimeAsync(2000);

        await abortExpectation;
        expect(webService.downloadEntries).toHaveBeenCalledTimes(1);
    });

    it('continues downloading while the version check keeps passing', async () => {
        webService.downloadEntries
            .mockResolvedValueOnce(makeResponse('page-1', [{ uuid: 'entry-1' }], 'page-2', 2))
            .mockResolvedValueOnce(makeResponse('page-2', [{ uuid: 'entry-2' }], null, 2));

        const downloadPromise = downloadService.downloadFormEntries('form-ref', {
            delayMs: 2000,
            shouldAbort: async () => null
        });

        await flushPromises();
        await vi.advanceTimersByTimeAsync(2000);
        await downloadPromise;

        expect(webService.downloadEntries).toHaveBeenCalledTimes(2);
        expect(databaseInsertService.insertEntries).toHaveBeenCalledTimes(2);
    });

    it('records the page checkpoint before honoring cancellation after a committed insert', async () => {
        let cancelled = false;
        const onPageDownloaded = vi.fn();

        webService.downloadEntries.mockResolvedValueOnce(makeResponse('page-1', [{ uuid: 'entry-1' }], 'page-2', 2));
        databaseInsertService.insertEntries.mockImplementationOnce(() => {
            cancelled = true;
            return Promise.resolve();
        });

        await expect(downloadService.downloadFormEntries('form-ref', {
            delayMs: 2000,
            isCancelled: () => cancelled,
            onPageDownloaded
        })).rejects.toMatchObject({
            cancelled: true
        });

        expect(onPageDownloaded).toHaveBeenCalledWith('page-1', 'page-2', {
            totalEntries: 2,
            processedEntries: 1
        });
        expect(notificationService.setProgressTransfer).toHaveBeenLastCalledWith({ total: 2, done: 1 });
        expect(webService.downloadEntries).toHaveBeenCalledTimes(1);
    });
});
