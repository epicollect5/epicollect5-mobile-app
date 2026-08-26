import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { fetchServerProjects } from '@/use/project/fetch-server-projects';
import { webService } from '@/services/web-service';
import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';

vi.mock('@/services/web-service', () => ({
    webService: {
        searchForProject: vi.fn(),
        getProjectImageUrl: vi.fn()
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        filterObjectsByUniqueKey: vi.fn((arr, key) => arr)
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: { DELAY_LONG: 0 }
}));

const DATA_URI = 'data:image/webp;base64,UklGRtIAAABXRUJQVlA4IMYAAAAQBgCdASpAAEAAPtFiqk8oJaQiKhmYAQAaCUAaJwMhgE0Egcz7SLgL81LexQmy7gWzXQxWPSd8w6AA';

describe('fetchServerProjects()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        utilsService.filterObjectsByUniqueKey.mockImplementation((arr) => arr);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('uses logo_base64 from the payload for public projects (no HTTP call per hit)', async () => {
        webService.searchForProject.mockResolvedValue({
            data: {
                data: [
                    {
                        type: 'project',
                        id: 'b7ce543d502d44438ad60237edddf6a2',
                        project: {
                            name: 'San Jose 2024',
                            slug: 'san-jose-2024',
                            access: 'public',
                            ref: 'b7ce543d502d44438ad60237edddf6a2',
                            logo_base64: DATA_URI
                        }
                    }
                ]
            }
        });

        const result = await fetchServerProjects('san jose');

        expect(webService.getProjectImageUrl).not.toHaveBeenCalled();
        expect(result).toHaveLength(1);
        expect(result[0].logo).toBe(DATA_URI);
        expect(result[0].access).toBe('public');
        expect(result[0].slug).toBe('san-jose-2024');
    });

    it('keeps project.logo as null for private projects (consumer renders locked placeholder)', async () => {
        webService.searchForProject.mockResolvedValue({
            data: {
                data: [
                    {
                        type: 'project',
                        id: 'private-ref-1',
                        project: {
                            name: 'Private Project',
                            slug: 'private-project',
                            access: 'private',
                            ref: 'private-ref-1',
                            logo_base64: null
                        }
                    }
                ]
            }
        });

        const result = await fetchServerProjects('private');

        expect(webService.getProjectImageUrl).not.toHaveBeenCalled();
        expect(result[0].logo).toBeNull();
        expect(result[0].access).toBe('private');
    });

    it('falls back to the legacy URL for a public project when logo_base64 is absent (feature flag off)', async () => {
        const legacyUrl = 'https://five.epicollect.net/api/media/old-server-project?type=photo&name=logo.jpg&format=project_mobile_logo';
        webService.getProjectImageUrl.mockReturnValue(legacyUrl);
        webService.searchForProject.mockResolvedValue({
            data: {
                data: [
                    {
                        type: 'project',
                        id: 'partial-ref-1',
                        project: {
                            name: 'Old Server Project',
                            slug: 'old-server-project',
                            access: 'public',
                            ref: 'partial-ref-1'
                        }
                    }
                ]
            }
        });

        const result = await fetchServerProjects('old');

        expect(webService.getProjectImageUrl).toHaveBeenCalledTimes(1);
        expect(webService.getProjectImageUrl).toHaveBeenCalledWith('old-server-project');
        expect(result[0].logo).toBe(legacyUrl);
    });

    it('falls back to the legacy URL for a private project when logo_base64 is absent (consumer still shows locked placeholder)', async () => {
        const legacyUrl = 'https://five.epicollect.net/api/media/private?type=photo&name=logo.jpg&format=project_mobile_logo';
        webService.getProjectImageUrl.mockReturnValue(legacyUrl);
        webService.searchForProject.mockResolvedValue({
            data: {
                data: [
                    {
                        type: 'project',
                        id: 'private-no-flag-1',
                        project: {
                            name: 'Private Without Flag',
                            slug: 'private-no-flag',
                            access: 'private',
                            ref: 'private-no-flag-1'
                        }
                    }
                ]
            }
        });

        const result = await fetchServerProjects('private');

        expect(webService.getProjectImageUrl).toHaveBeenCalledWith('private-no-flag');
        expect(result[0].logo).toBe(legacyUrl);
        expect(result[0].access).toBe('private');
    });

    it('passes through an explicit logo_base64: null for a public project (no URL fallback)', async () => {
        webService.searchForProject.mockResolvedValue({
            data: {
                data: [
                    {
                        type: 'project',
                        id: 'public-no-logo-1',
                        project: {
                            name: 'Public Without Logo',
                            slug: 'public-no-logo',
                            access: 'public',
                            ref: 'public-no-logo-1',
                            logo_base64: null
                        }
                    }
                ]
            }
        });

        const result = await fetchServerProjects('public');

        expect(webService.getProjectImageUrl).not.toHaveBeenCalled();
        expect(result[0].logo).toBeNull();
    });

    it('passes through an explicit empty string logo_base64 for a public project (no URL fallback)', async () => {
        webService.searchForProject.mockResolvedValue({
            data: {
                data: [
                    {
                        type: 'project',
                        id: 'public-empty-logo-1',
                        project: {
                            name: 'Public Empty Logo',
                            slug: 'public-empty-logo',
                            access: 'public',
                            ref: 'public-empty-logo-1',
                            logo_base64: ''
                        }
                    }
                ]
            }
        });

        const result = await fetchServerProjects('public');

        expect(webService.getProjectImageUrl).not.toHaveBeenCalled();
        expect(result[0].logo).toBe('');
    });

    it('deduplicates results by ref via utilsService.filterObjectsByUniqueKey', async () => {
        webService.searchForProject.mockResolvedValue({
            data: {
                data: [
                    {
                        type: 'project',
                        id: 'dup-1',
                        project: {
                            name: 'Dup A',
                            slug: 'dup',
                            access: 'public',
                            ref: 'dup-ref',
                            logo_base64: DATA_URI
                        }
                    },
                    {
                        type: 'project',
                        id: 'dup-2',
                        project: {
                            name: 'Dup B',
                            slug: 'dup',
                            access: 'public',
                            ref: 'dup-ref',
                            logo_base64: DATA_URI
                        }
                    }
                ]
            }
        });

        await fetchServerProjects('dup');

        expect(utilsService.filterObjectsByUniqueKey).toHaveBeenCalledTimes(1);
        expect(utilsService.filterObjectsByUniqueKey).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ ref: 'dup-ref' }),
                expect.objectContaining({ ref: 'dup-ref' })
            ]),
            'ref'
        );
    });

    it('resolves to an empty array when the server returns no hits', async () => {
        webService.searchForProject.mockResolvedValue({ data: { data: [] } });

        const result = await fetchServerProjects('nothing');

        expect(result).toEqual([]);
    });

    it('rejects when webService.searchForProject rejects', async () => {
        const error = { data: { errors: [{ code: 'ec5_999' }] } };
        webService.searchForProject.mockRejectedValue(error);

        await expect(fetchServerProjects('boom')).rejects.toBe(error);
    });

    it('defers the HTTP call via window.setTimeout (DELAY_LONG throttle wrapper)', async () => {
        vi.useFakeTimers();
        const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
        webService.searchForProject.mockResolvedValue({ data: { data: [] } });

        const pending = fetchServerProjects('deferred');

        // The call should be scheduled, not yet executed.
        expect(webService.searchForProject).not.toHaveBeenCalled();
        expect(setTimeoutSpy).toHaveBeenCalled();

        await vi.runAllTimersAsync();
        await pending;

        expect(webService.searchForProject).toHaveBeenCalledTimes(1);
        expect(webService.searchForProject).toHaveBeenCalledWith('deferred', false);

        setTimeoutSpy.mockRestore();
    });
});
