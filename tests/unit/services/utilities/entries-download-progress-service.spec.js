import { describe, it, expect, beforeEach, vi } from 'vitest';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';

describe('entriesDownloadProgressService', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.clearAllMocks();
    });

    it('returns empty progress when nothing is stored', () => {
        expect(entriesDownloadProgressService.load('project-ref', 'form-ref')).toEqual({
            urls: {},
            startUrl: null,
            totalEntries: 0,
            processedEntries: 0,
            updatedAt: null
        });
    });

    it('saves and loads persisted progress for a project form', () => {
        const progress = {
            urls: {
                'page-1': 'page-2'
            },
            startUrl: 'page-1',
            totalEntries: 5678,
            processedEntries: 250,
            updatedAt: 1
        };

        entriesDownloadProgressService.save('project-ref', 'form-ref', progress);

        expect(entriesDownloadProgressService.load('project-ref', 'form-ref')).toEqual(progress);
        expect(window.localStorage.getItem('entries-download-progress:project-ref:form-ref')).toBe(JSON.stringify(progress));
    });

    it('clears persisted progress for a project form', () => {
        entriesDownloadProgressService.save('project-ref', 'form-ref', {
            urls: {
                'page-1': 'page-2'
            },
            startUrl: 'page-1',
            totalEntries: 5678,
            processedEntries: 250,
            updatedAt: 1
        });

        entriesDownloadProgressService.clear('project-ref', 'form-ref');

        expect(entriesDownloadProgressService.load('project-ref', 'form-ref')).toEqual({
            urls: {},
            startUrl: null,
            totalEntries: 0,
            processedEntries: 0,
            updatedAt: null
        });
    });

    it('removes malformed persisted progress and returns empty progress', () => {
        window.localStorage.setItem('entries-download-progress:project-ref:form-ref', 'not-json');

        expect(entriesDownloadProgressService.load('project-ref', 'form-ref')).toEqual({
            urls: {},
            startUrl: null,
            totalEntries: 0,
            processedEntries: 0,
            updatedAt: null
        });
        expect(window.localStorage.getItem('entries-download-progress:project-ref:form-ref')).toBeNull();
    });
});
