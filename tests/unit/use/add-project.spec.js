import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                wait: 'Please wait',
                loading_project: 'Loading project'
            },
            status_codes: {
                ec5_111: 'Project exists',
                ec5_112: 'Project added',
                ec5_133: 'No inputs',
                ec5_138: 'Logo failed'
            }
        }
    }
}));

vi.mock('@/services/web-service', () => ({
    webService: {
        getProject: vi.fn()
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        projectRefExists: vi.fn()
    }
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: {
        insertProject: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showToast: vi.fn(),
        showAlert: vi.fn(),
        confirmSingle: vi.fn()
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: {
        handleWebError: vi.fn()
    }
}));

vi.mock('@/services/project-logo-service', () => ({
    projectLogoService: {
        downloadFromServer: vi.fn()
    }
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        loadExtraStructure: vi.fn(),
        getExtraInputs: vi.fn(),
        destroy: vi.fn()
    }
}));

vi.mock('@/composables/auth/show-modal-login', () => ({
    showModalLogin: vi.fn()
}));

vi.mock('@/composables/auth/logout', () => ({
    logout: vi.fn()
}));

describe('addProject', () => {
    let addProject;
    let useRootStore;
    let webService;
    let databaseSelectService;
    let databaseInsertService;
    let notificationService;
    let projectLogoService;
    let projectModel;

    const router = {
        replace: vi.fn()
    };

    const project = {
        slug: 'test-project',
        name: 'Test Project',
        ref: 'a'.repeat(32)
    };

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setActivePinia(createPinia());

        vi.spyOn(window, 'setTimeout').mockImplementation((callback) => {
            callback();
            return 0;
        });

        ({addProject} = await import('@/composables/project/add-project'));
        ({useRootStore} = await import('@/stores/root-store'));
        ({webService} = await import('@/services/web-service'));
        ({databaseSelectService} = await import('@/services/database/database-select-service'));
        ({databaseInsertService} = await import('@/services/database/database-insert-service'));
        ({notificationService} = await import('@/services/notification-service'));
        ({projectLogoService} = await import('@/services/project-logo-service'));
        ({projectModel} = await import('@/models/project-model.js'));

        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.serverUrl = 'https://five.epicollect.net';

        webService.getProject.mockResolvedValue({
            data: {
                meta: {
                    project_extra: {},
                    project_mapping: [],
                    project_stats: {
                        structure_last_updated: '2026-04-16T00:00:00.000Z'
                    }
                }
            }
        });
        projectModel.getExtraInputs.mockReturnValue([{}]);
        databaseSelectService.projectRefExists.mockResolvedValue(false);
        databaseInsertService.insertProject.mockResolvedValue(true);
        projectLogoService.downloadFromServer.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not insert a downloaded project when the project ref already exists locally', async () => {
        databaseSelectService.projectRefExists.mockResolvedValue(true);

        await addProject(project, router);

        expect(databaseSelectService.projectRefExists).toHaveBeenCalledWith(project.ref);
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith('Project exists');
    });
});
