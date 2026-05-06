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

    it('returns empty progress when localStorage getItem fails', () => {
        const error = new Error('storage unavailable');
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw error;
        });

        expect(entriesDownloadProgressService.load('project-ref', 'form-ref')).toEqual({
            urls: {},
            startUrl: null,
            totalEntries: 0,
            processedEntries: 0,
            updatedAt: null
        });
        expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to load entries download progress:', error);

        getItemSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('returns empty progress when malformed progress cleanup fails', () => {
        const error = new Error('remove unavailable');
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw error;
        });

        window.localStorage.setItem('entries-download-progress:project-ref:form-ref', 'not-json');

        expect(entriesDownloadProgressService.load('project-ref', 'form-ref')).toEqual({
            urls: {},
            startUrl: null,
            totalEntries: 0,
            processedEntries: 0,
            updatedAt: null
        });
        expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to remove invalid entries download progress:', error);

        removeItemSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('does not throw when saving progress fails', () => {
        const error = new Error('save unavailable');
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw error;
        });

        expect(() => entriesDownloadProgressService.save('project-ref', 'form-ref', {})).not.toThrow();
        expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to save entries download progress:', error);

        setItemSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });
});
