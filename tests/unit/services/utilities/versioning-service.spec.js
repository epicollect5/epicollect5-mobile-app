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
        selectProjectMedia: vi.fn().mockResolvedValue({ audios: [], photos: [], videos: [] }),
        selectDistinctFormRefs: vi.fn().mockResolvedValue([]),
        selectDistinctBranchRefsIncludingTemp: vi.fn().mockResolvedValue([])
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
        //no form has been removed, so no cleanup is needed
        expect(databaseDeleteService.deleteFormEntries).not.toHaveBeenCalled();
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

        //stored branch entries reference the removed branch_b
        databaseSelectService.selectDistinctBranchRefsIncludingTemp.mockResolvedValue([
            { formRef: 'form_ref_1', branchRef: 'branch_b' }
        ]);

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

    it('removes the entries and media of forms removed from the project', async () => {
        //previous structure: two forms (parent A, child B)
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: ['form_ref_a', 'form_ref_b']
            },
            forms: {
                form_ref_a: {
                    details: { name: 'Form A' },
                    inputs: [],
                    branch: {}
                },
                form_ref_b: {
                    details: { name: 'Form B' },
                    inputs: [],
                    branch: {}
                }
            },
            inputs: {}
        });

        //new structure: form B has been removed on the server
        webService.getProject.mockResolvedValue({
            data: {
                meta: {
                    project_extra: {
                        project: {
                            details: { slug: 'test-project', ref: 'test-ref' },
                            forms: ['form_ref_a']
                        },
                        forms: {
                            form_ref_a: {
                                details: { name: 'Form A' },
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

        //form B has entries and media on the device
        databaseSelectService.selectDistinctFormRefs.mockResolvedValue(['form_ref_b']);
        databaseSelectService.selectEntries.mockImplementation((projectRef, formRef) => {
            if (formRef === 'form_ref_b') {
                return Promise.resolve({
                    rows: {
                        length: 2,
                        item: (i) => [
                            { entry_uuid: 'entry-1' },
                            { entry_uuid: 'entry-2' }
                        ][i]
                    }
                });
            }
            return Promise.resolve({ rows: { length: 0 } });
        });
        databaseSelectService.selectBranchEntries.mockImplementation((projectRef, formRef) => {
            if (formRef === 'form_ref_b') {
                return Promise.resolve({
                    rows: {
                        length: 1,
                        item: () => ({ entry_uuid: 'branch-entry-1' })
                    }
                });
            }
            return Promise.resolve({ rows: { length: 0 } });
        });
        databaseSelectService.selectProjectMedia.mockImplementation((options) => {
            if (options.entry_uuid[0] === 'entry-1') {
                return Promise.resolve({
                    audios: [],
                    photos: [{ name: 'photo-1.jpg' }],
                    videos: []
                });
            }
            return Promise.resolve({ audios: [], photos: [], videos: [] });
        });

        await expect(versioningService.updateProject()).resolves.toBe(false);

        //cleanup only targets the removed form
        expect(databaseDeleteService.deleteFormEntries).toHaveBeenCalledWith('test-ref', ['form_ref_b']);
        //media is fetched one entry at a time (selectProjectMedia only supports a single entry_uuid)
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: 'test-ref',
            synced: null,
            entry_uuid: ['entry-1']
        });
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: 'test-ref',
            synced: null,
            entry_uuid: ['branch-entry-1']
        });
        //media files are removed before the rows
        expect(deleteFileService.removeFiles).toHaveBeenCalledWith([
            { name: 'photo-1.jpg' }
        ]);
        expect(downloadFileService.downloadProjectLogo).toHaveBeenCalledWith('test-project', 'test-ref');
    });

    it('rejects when the cleanup of removed forms fails', async () => {
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: ['form_ref_a', 'form_ref_b']
            },
            forms: {
                form_ref_a: {
                    details: { name: 'Form A' },
                    inputs: [],
                    branch: {}
                },
                form_ref_b: {
                    details: { name: 'Form B' },
                    inputs: [],
                    branch: {}
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
                            forms: ['form_ref_a']
                        },
                        forms: {
                            form_ref_a: {
                                details: { name: 'Form A' },
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

        //stale entries of the removed form are still stored locally
        databaseSelectService.selectDistinctFormRefs.mockResolvedValue(['form_ref_b']);
        //no stale branches
        databaseSelectService.selectDistinctBranchRefsIncludingTemp.mockResolvedValue([]);

        //cleanup failure must block the project update
        databaseDeleteService.deleteFormEntries.mockRejectedValue(new Error('db error'));

        await expect(versioningService.updateProject()).rejects.toMatchObject({ isStaleCleanupError: true });
        expect(databaseDeleteService.deleteFormEntries).toHaveBeenCalledWith('test-ref', ['form_ref_b']);
        expect(downloadFileService.downloadProjectLogo).not.toHaveBeenCalled();
    });

    it('keeps cleanup retryable after media is removed but database cleanup fails', async () => {
        const mediaFile = {
            file_path: 'file:///data/photos/',
            project_ref: 'test-ref',
            file_name: 'photo-1.jpg'
        };

        databaseSelectService.selectEntries.mockResolvedValue({
            rows: {
                length: 1,
                item: () => ({ entry_uuid: 'entry-1' })
            }
        });
        databaseSelectService.selectBranchEntries.mockResolvedValue({ rows: { length: 0 } });
        databaseSelectService.selectProjectMedia.mockResolvedValue({
            audios: [],
            photos: [mediaFile],
            videos: []
        });
        databaseDeleteService.deleteFormEntries.mockRejectedValue(new Error('db error'));

        await expect(
            versioningService._removeStaleFormsEntries('test-ref', ['form_ref_b'])
        ).rejects.toThrow('db error');

        expect(deleteFileService.removeFiles).toHaveBeenCalledWith([mediaFile]);
        expect(deleteFileService.removeFiles.mock.invocationCallOrder[0])
            .toBeLessThan(databaseDeleteService.deleteFormEntries.mock.invocationCallOrder[0]);
    });

    it('rejects when the cleanup of removed branches fails', async () => {
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

        //stored branch entries reference the removed branch_b
        databaseSelectService.selectDistinctBranchRefsIncludingTemp.mockResolvedValue([
            { formRef: 'form_ref_1', branchRef: 'branch_b' }
        ]);
        //no stale forms
        databaseSelectService.selectDistinctFormRefs.mockResolvedValue([]);
        databaseDeleteService.deleteFormEntries.mockResolvedValue();

        databaseSelectService.selectBranchEntries.mockResolvedValue({
            rows: {
                length: 1,
                item: (i) => [{ entry_uuid: 'branch-entry-1' }][i]
            }
        });

        //cleanup failure must block the project update
        databaseDeleteService.deleteBranchEntry.mockRejectedValue(new Error('db error'));

        await expect(versioningService.updateProject()).rejects.toMatchObject({ isStaleCleanupError: true });
        expect(databaseDeleteService.deleteBranchEntry).toHaveBeenCalledWith('branch-entry-1');
        expect(downloadFileService.downloadProjectLogo).not.toHaveBeenCalled();
    });

    it('retries the cleanup of a form already absent from the persisted structure', async () => {
        //the persisted structure already omits form B (a previous update persisted it
        //without form B, but its cleanup failed and left stale entries behind)
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: ['form_ref_a']
            },
            forms: {
                form_ref_a: {
                    details: { name: 'Form A' },
                    inputs: [],
                    branch: {}
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
                            forms: ['form_ref_a']
                        },
                        forms: {
                            form_ref_a: {
                                details: { name: 'Form A' },
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

        //stale entries of form B are still stored locally
        databaseSelectService.selectDistinctFormRefs.mockResolvedValue(['form_ref_b']);
        //no stale branches
        databaseSelectService.selectDistinctBranchRefsIncludingTemp.mockResolvedValue([]);
        databaseDeleteService.deleteFormEntries.mockResolvedValue();
        databaseDeleteService.deleteBranchEntry.mockResolvedValue();
        databaseSelectService.selectEntries.mockImplementation((projectRef, formRef) => {
            if (formRef === 'form_ref_b') {
                return Promise.resolve({
                    rows: {
                        length: 1,
                        item: () => ({ entry_uuid: 'entry-1' })
                    }
                });
            }
            return Promise.resolve({ rows: { length: 0 } });
        });

        await expect(versioningService.updateProject()).resolves.toBe(false);

        //the cleanup is retried even though both structures omit form B
        expect(databaseSelectService.selectDistinctFormRefs).toHaveBeenCalledWith('test-ref');
        expect(databaseDeleteService.deleteFormEntries).toHaveBeenCalledWith('test-ref', ['form_ref_b']);
        expect(downloadFileService.downloadProjectLogo).toHaveBeenCalledWith('test-project', 'test-ref');
    });

    it('keeps the previous structure in the model when the persistence fails', async () => {
        projectModel.loadExtraStructure({
            project: {
                details: { slug: 'test-project', ref: 'test-ref' },
                forms: ['form_ref_a', 'form_ref_b']
            },
            forms: {
                form_ref_a: {
                    details: { name: 'Form A' },
                    inputs: [],
                    branch: {}
                },
                form_ref_b: {
                    details: { name: 'Form B' },
                    inputs: [],
                    branch: {}
                }
            },
            inputs: {}
        });
        projectModel.setLastUpdated('2023-01-01');

        webService.getProject.mockResolvedValue({
            data: {
                meta: {
                    project_extra: {
                        project: {
                            details: { slug: 'test-project', ref: 'test-ref' },
                            forms: ['form_ref_a']
                        },
                        forms: {
                            form_ref_a: {
                                details: { name: 'Form A' },
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

        //persistence of the new structure fails
        databaseUpdateService.updateProject.mockRejectedValue(new Error('db error'));

        await expect(versioningService.updateProject()).rejects.toThrow('db error');

        //model and database stay consistent with the previous structure
        expect(projectModel.getProjectExtra().project.forms).toEqual(['form_ref_a', 'form_ref_b']);
        expect(projectModel.getLastUpdated()).toBe('2023-01-01');
        //no cleanup runs, no logo download, and the model keeps the old mappings
        expect(databaseSelectService.selectDistinctFormRefs).not.toHaveBeenCalled();
        expect(downloadFileService.downloadProjectLogo).not.toHaveBeenCalled();
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
