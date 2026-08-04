import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { webService } from '@/services/web-service';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { downloadFileService } from '@/services/download-file-service';
import { projectModel } from '@/models/project-model.js';
import { logout } from '@/use/auth/logout';
import { showModalLogin } from '@/use/auth/show-modal-login';
import { addProject } from '@/use/project/add-project';

vi.mock('@/services/web-service', () => ({
    webService: { getProject: vi.fn() }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn(),
        showToast: vi.fn(),
        confirmSingle: vi.fn()
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: { handleWebError: vi.fn() }
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: { insertProject: vi.fn() }
}));

vi.mock('@/services/download-file-service', () => ({
    downloadFileService: { downloadProjectLogo: vi.fn() }
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        loadExtraStructure: vi.fn(),
        getExtraInputs: vi.fn(),
        destroy: vi.fn()
    }
}));

vi.mock('@/use/auth/logout', () => ({ logout: vi.fn() }));
vi.mock('@/use/auth/show-modal-login', () => ({ showModalLogin: vi.fn() }));

vi.mock('@/config', () => ({
    PARAMETERS: {
        AUTH_ERROR_CODES: ['ec5_70', 'ec5_71', 'ec5_77', 'ec5_78', 'ec5_50', 'ec5_51'],
        ROUTES: { PROJECTS: 'projects' },
        DELAY_MEDIUM: 0
    },
    DB_ERRORS: {
        0: 'ec5_109'
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: { wait: 'wait', loading_project: 'loading project', error: 'Error', ok: 'OK' },
            status_codes: {
                ec5_77: 'Private project',
                ec5_78: 'Access denied',
                ec5_112: 'Project added',
                ec5_116: 'Something went wrong',
                ec5_133: 'This project has no inputs',
                ec5_135: 'No internet connection',
                ec5_109: 'Database error',
                ec5_111: 'Project already exists'
            }
        }
    }
}));

describe('addProject()', () => {

    let router;
    const project = { slug: 'water12', name: 'Water', ref: 'water12' };
    const successResponse = {
        data: {
            meta: {
                project_extra: { type: 'structure' },
                project_stats: { structure_last_updated: '2024-01-01' },
                project_mapping: {}
            }
        }
    };

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.serverUrl = 'https://five.epicollect.net';

        router = { replace: vi.fn() };
        projectModel.getExtraInputs.mockReturnValue([{ ref: 'input_1' }]);
        databaseInsertService.insertProject.mockResolvedValue();
        downloadFileService.downloadProjectLogo.mockResolvedValue();
        notificationService.confirmSingle.mockResolvedValue(false);
    });

    it('does not throw and handles a network error when getProject rejects with undefined', async () => {
        webService.getProject.mockRejectedValue(undefined);

        await expect(addProject(project, router)).resolves.toBeUndefined();

        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(errorsService.handleWebError).toHaveBeenCalledWith(undefined);
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
        expect(router.replace).not.toHaveBeenCalled();
    });

    it('does not throw and handles a timeout error when getProject rejects with a null error', async () => {
        webService.getProject.mockRejectedValue(null);

        await expect(addProject(project, router)).resolves.toBeUndefined();

        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(errorsService.handleWebError).toHaveBeenCalledWith(null);
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
        expect(router.replace).not.toHaveBeenCalled();
    });

    it('handles non-auth web errors via errorsService.handleWebError', async () => {
        const error = { data: { errors: [{ code: 'ec5_999' }] } };
        webService.getProject.mockRejectedValue(error);

        await expect(addProject(project, router)).resolves.toBeUndefined();

        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(errorsService.handleWebError).toHaveBeenCalledWith(error);
        expect(logout).not.toHaveBeenCalled();
        expect(showModalLogin).not.toHaveBeenCalled();
    });

    it('requests login again when an auth error is confirmed', async () => {
        const rootStore = useRootStore();
        const authError = { data: { errors: [{ code: 'ec5_77' }] } };
        webService.getProject.mockRejectedValue(authError);
        notificationService.confirmSingle.mockResolvedValue(true);

        await expect(addProject(project, router)).resolves.toBeUndefined();

        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(notificationService.confirmSingle).toHaveBeenCalled();
        expect(rootStore.afterUserIsLoggedIn).toEqual({ callback: addProject, params: [project, router] });
        expect(logout).toHaveBeenCalled();
        expect(showModalLogin).toHaveBeenCalled();
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
    });

    it('does not logout when the user declines the auth login prompt', async () => {
        const rootStore = useRootStore();
        const authError = { data: { errors: [{ code: 'ec5_77' }] } };
        webService.getProject.mockRejectedValue(authError);
        notificationService.confirmSingle.mockResolvedValue(false);

        await expect(addProject(project, router)).resolves.toBeUndefined();

        expect(rootStore.afterUserIsLoggedIn.callback).toBeNull();
        expect(logout).not.toHaveBeenCalled();
        expect(showModalLogin).not.toHaveBeenCalled();
    });

    it('does not add a project that has no inputs', async () => {
        projectModel.getExtraInputs.mockReturnValue([]);
        webService.getProject.mockResolvedValue(successResponse);

        // the no-inputs branch never resolves the returned promise, so assert the side effects
        const pending = addProject(project, router);
        await vi.waitFor(() => {
            expect(notificationService.showAlert).toHaveBeenCalled();
        });

        expect(notificationService.showAlert).toHaveBeenCalledWith(
            'This project has no inputs'
        );
        expect(databaseInsertService.insertProject).not.toHaveBeenCalled();
        expect(downloadFileService.downloadProjectLogo).not.toHaveBeenCalled();
        expect(pending).not.toBeNull();
    });

    it('adds a project and navigates to the projects list on success', async () => {
        webService.getProject.mockResolvedValue(successResponse);

        await expect(addProject(project, router)).resolves.toBeUndefined();

        expect(projectModel.loadExtraStructure).toHaveBeenCalledWith({ type: 'structure' });
        expect(projectModel.destroy).toHaveBeenCalled();
        expect(databaseInsertService.insertProject).toHaveBeenCalledWith(
            project.slug,
            project.name,
            project.ref,
            JSON.stringify({ type: 'structure' }),
            'https://five.epicollect.net',
            '2024-01-01',
            JSON.stringify({})
        );
        expect(downloadFileService.downloadProjectLogo).toHaveBeenCalledWith(project.slug, project.ref);
        expect(notificationService.showToast).toHaveBeenCalledWith(
            'Project added'
        );
        expect(router.replace).toHaveBeenCalledWith({
            name: 'projects',
            query: { refresh: true }
        });
    });
});
