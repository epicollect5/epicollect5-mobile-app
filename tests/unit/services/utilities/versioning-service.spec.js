import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { versioningService } from '@/services/utilities/versioning-service';
import { projectModel } from '@/models/project-model';
import { webService } from '@/services/web-service';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { downloadFileService } from '@/services/download-file-service';
import { utilsService } from '@/services/utilities/utils-service';
import { useRootStore } from '@/stores/root-store';

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        selectEntries: vi.fn().mockResolvedValue({ rows: { length: 0 } }),
        selectBranchEntries: vi.fn().mockResolvedValue({ rows: { length: 0 } }),
        selectProjectMedia: vi.fn().mockResolvedValue({ audios: [], photos: [], videos: [] })
    }
}));

vi.mock('@/services/database/database-update-service', () => ({
    databaseUpdateService: { updateProject: vi.fn().mockResolvedValue() }
}));

vi.mock('@/services/database/database-delete-service', () => ({
    databaseDeleteService: {
        deleteFormEntries: vi.fn().mockResolvedValue(),
        deleteBranchEntry: vi.fn().mockResolvedValue(),
        deleteEntryMedia: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/filesystem/delete-file-service', () => ({
    deleteFileService: { removeFiles: vi.fn().mockResolvedValue() }
}));

vi.mock('@/services/download-file-service', () => ({
    downloadFileService: { downloadProjectLogo: vi.fn().mockResolvedValue() }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        hasInternetConnection: vi.fn()
    }
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
        utilsService.hasInternetConnection.mockResolvedValue(true);
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

    it('keeps the in-memory mapping in sync with the updated structure', async () => {
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: []
            },
            forms: {},
            inputs: {}
        });
        projectModel.loadMappings({
            forms: { old_form_ref: [] }
        });

        const newMapping = {
            forms: { 'new_form_ref_6a75fca832beb': { inputs: {} } }
        };

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
                    project_mapping: newMapping,
                    project_stats: { structure_last_updated: '2024-01-01' }
                }
            }
        });

        await expect(versioningService.updateProject()).resolves.toBe(false);
        expect(projectModel.getProjectMappings()).toEqual(newMapping);
    });

    it('removes the entries and media of branches removed from the project', async () => {
        //previous structure: form with two branches (branch_a, branch_b)
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: ['form_ref_1']
            },
            forms: {
                form_ref_1: {
                    details: { name: 'Form' },
                    inputs: [],
                    branch: {
                        branch_a: ['input_a'],
                        branch_b: ['input_b']
                    }
                }
            },
            inputs: {}
        });

        //new structure: branch_b has been removed
        webService.getProject.mockResolvedValue({
            data: {
                meta: {
                    project_extra: {
                        project: {
                            details: { slug: 'test-project', ref: 'test-ref' },
                            forms: ['form_ref_1']
                        },
                        forms: {
                            form_ref_1: {
                                details: { name: 'Form' },
                                inputs: [],
                                branch: {
                                    branch_a: ['input_a']
                                }
                            }
                        },
                        inputs: {}
                    },
                    project_mapping: {},
                    project_stats: { structure_last_updated: '2024-01-01' }
                }
            }
        });

        const branchEntries = [
            { entry_uuid: 'branch-entry-1' },
            { entry_uuid: 'branch-entry-2' }
        ];

        databaseSelectService.selectBranchEntries.mockResolvedValue({
            rows: {
                length: branchEntries.length,
                item: (i) => branchEntries[i]
            }
        });

        databaseSelectService.selectProjectMedia.mockImplementation((options) => {
            if (options.entry_uuid[0] === 'branch-entry-1') {
                return Promise.resolve({
                    audios: [],
                    photos: [{ name: 'photo-1.jpg' }],
                    videos: []
                });
            }
            return Promise.resolve({ audios: [], photos: [], videos: [] });
        });

        await expect(versioningService.updateProject()).resolves.toBe(false);

        //cleanup only targets the removed branch
        expect(databaseSelectService.selectBranchEntries).toHaveBeenCalledWith(
            'test-ref', 'form_ref_1', 'branch_b'
        );
        expect(databaseSelectService.selectBranchEntries).not.toHaveBeenCalledWith(
            'test-ref', 'form_ref_1', 'branch_a'
        );

        //media files are removed before the rows
        expect(databaseDeleteService.deleteEntryMedia).toHaveBeenCalledWith('branch-entry-1');
        expect(databaseDeleteService.deleteEntryMedia).toHaveBeenCalledWith('branch-entry-2');
        expect(databaseDeleteService.deleteBranchEntry).toHaveBeenCalledWith('branch-entry-1');
        expect(databaseDeleteService.deleteBranchEntry).toHaveBeenCalledWith('branch-entry-2');
        expect(deleteFileService.removeFiles).toHaveBeenCalledWith([
            { name: 'photo-1.jpg' }
        ]);
        expect(downloadFileService.downloadProjectLogo).toHaveBeenCalledWith('test-project', 'test-ref');
    });

    it('resolves even when the cleanup of removed branches fails', async () => {
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: ['form_ref_1']
            },
            forms: {
                form_ref_1: {
                    details: { name: 'Form' },
                    inputs: [],
                    branch: {
                        branch_b: ['input_b']
                    }
                }
            },
            inputs: {}
        });

        webService.getProject.mockResolvedValue({
            data: {
                meta: {
                    project_extra: {
                        project: {
                            details: { slug: 'test-project', ref: 'test-ref' },
                            forms: ['form_ref_1']
                        },
                        forms: {
                            form_ref_1: {
                                details: { name: 'Form' },
                                inputs: [],
                                branch: {}
                            }
                        },
                        inputs: {}
                    },
                    project_mapping: {},
                    project_stats: { structure_last_updated: '2024-01-01' }
                }
            }
        });

        databaseSelectService.selectBranchEntries.mockResolvedValue({
            rows: {
                length: 1,
                item: (i) => [{ entry_uuid: 'branch-entry-1' }][i]
            }
        });

        //cleanup failure must not block the project update
        databaseDeleteService.deleteBranchEntry.mockRejectedValue(new Error('db error'));

        await expect(versioningService.updateProject()).resolves.toBe(false);
        expect(databaseDeleteService.deleteBranchEntry).toHaveBeenCalledWith('branch-entry-1');
        expect(downloadFileService.downloadProjectLogo).toHaveBeenCalledWith('test-project', 'test-ref');
    });
});

describe('versioningService.checkProjectVersion()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = 'en';
        projectModel.destroy();
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: []
            },
            forms: {},
            inputs: {}
        });
        vi.clearAllMocks();
        utilsService.hasInternetConnection.mockResolvedValue(true);
    });

    it('resolves true when the remote and local versions match', async () => {
        webService.getProjectVersion.mockResolvedValue({
            data: {
                data: {
                    attributes: { structure_last_updated: projectModel.getLastUpdated() }
                }
            }
        });

        await expect(versioningService.checkProjectVersion()).resolves.toBe(true);
    });

    it('resolves false when the remote version differs from the local one', async () => {
        webService.getProjectVersion.mockResolvedValue({
            data: {
                data: {
                    attributes: { structure_last_updated: '2024-01-01' }
                }
            }
        });

        await expect(versioningService.checkProjectVersion()).resolves.toBe(false);
    });

    it('rejects when the project was trashed on the server (ec5_11)', async () => {
        const trashedError = {
            data: {
                errors: [{ code: 'ec5_11' }]
            },
            status: 400
        };
        webService.getProjectVersion.mockRejectedValue(trashedError);

        await expect(versioningService.checkProjectVersion()).rejects.toBe(trashedError);
    });

    it('resolves true on any other error to avoid blocking the user', async () => {
        webService.getProjectVersion.mockRejectedValue(new Error('Network Fail'));

        await expect(versioningService.checkProjectVersion()).resolves.toBe(true);
    });

    it('resolves true when there is no internet connection', async () => {
        utilsService.hasInternetConnection.mockResolvedValue(false);

        await expect(versioningService.checkProjectVersion()).resolves.toBe(true);
        expect(webService.getProjectVersion).not.toHaveBeenCalled();
    });
});
