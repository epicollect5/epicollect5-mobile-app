import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { versioningService } from '@/services/utilities/versioning-service';
import { projectModel } from '@/models/project-model';
import { webService } from '@/services/web-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { downloadFileService } from '@/services/download-file-service';
import { useRootStore } from '@/stores/root-store';

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {}
}));

vi.mock('@/services/database/database-update-service', () => ({
    databaseUpdateService: { updateProject: vi.fn().mockResolvedValue() }
}));

vi.mock('@/services/database/database-delete-service', () => ({
    databaseDeleteService: { deleteFormEntries: vi.fn().mockResolvedValue() }
}));

vi.mock('@/services/download-file-service', () => ({
    downloadFileService: { downloadProjectLogo: vi.fn().mockResolvedValue() }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {}
}));

vi.mock('@/services/entry/answer-service', () => ({
    answerService: {}
}));

vi.mock('@/services/web-service', () => ({
    webService: {
        getProject: vi.fn(),
        getProjectVersion: vi.fn()
    }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        DEFAULT_LANGUAGE: 'en'
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: { not_available: 'N/A' },
            status_codes: {
                ec5_116: 'Project not found or not available'
            }
        }
    }
}));

describe('versioningService.updateProject()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = 'en';
        projectModel.destroy();
        vi.clearAllMocks();
    });

    it('rejects cleanly instead of crashing when no project is loaded', async () => {
        await expect(versioningService.updateProject()).rejects.toMatchObject({
            data: {
                errors: [{ code: 'ec5_116' }]
            }
        });
        // Must not call the web service with an empty slug
        expect(webService.getProject).not.toHaveBeenCalled();
    });

    it('fetches and updates the loaded project when a project is present', async () => {
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: []
            },
            forms: {},
            inputs: {}
        });

        webService.getProject.mockResolvedValue({
            data: {
                meta: {
                    project_extra: {
                        project: {
                            details: { slug: 'test-project', ref: 'test-ref' },
                            forms: []
                        },
                        forms: {},
                        inputs: {}
                    },
                    project_mapping: {},
                    project_stats: { structure_last_updated: '2024-01-01' }
                }
            }
        });

        await expect(versioningService.updateProject()).resolves.toBe(false);
        expect(webService.getProject).toHaveBeenCalledWith('test-project');
        expect(databaseUpdateService.updateProject).toHaveBeenCalledWith(
            'test-ref',
            expect.any(String),
            expect.any(String),
            '2024-01-01'
        );
        expect(databaseDeleteService.deleteFormEntries).toHaveBeenCalled();
        expect(downloadFileService.downloadProjectLogo).toHaveBeenCalledWith('test-project', 'test-ref');
    });
});
