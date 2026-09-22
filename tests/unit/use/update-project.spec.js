import { vi, describe, it, expect, beforeEach } from 'vitest';
import flushPromises from 'flush-promises';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { versioningService } from '@/services/utilities/versioning-service';
import { notificationService } from '@/services/notification-service';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';
import { logout } from '@/use/auth/logout';
import { showModalLogin } from '@/use/auth/show-modal-login';
import { updateProject } from '@/use/project/update-project';
import { PARAMETERS } from '@/config';
import { errorsService } from '@/services/errors-service';
import { projectModel } from '@/models/project-model';

vi.mock('@/services/utilities/versioning-service', () => ({
    versioningService: {
        updateProject: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn()
    }
}));

vi.mock('@/services/utilities/entries-download-progress-service', () => ({
    entriesDownloadProgressService: { clearProject: vi.fn() }
}));

vi.mock('@/use/auth/logout', () => ({ logout: vi.fn().mockResolvedValue(true) }));
vi.mock('@/use/auth/show-modal-login', () => ({ showModalLogin: vi.fn() }));
vi.mock('@/services/errors-service', () => ({
    errorsService: { handleWebError: vi.fn() }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        AUTH_ERROR_CODES: ['ec5_70', 'ec5_71', 'ec5_77', 'ec5_78', 'ec5_50', 'ec5_51'],
        ROUTES: { ENTRIES: 'entries' }
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                wait: 'wait',
                updating_project: 'updating',
                stale_cleanup_failed: 'stale cleanup failed',
                error: 'Error'
            },
            status_codes: {
                ec5_70: 'Please log in',
                ec5_71: 'Permission denied',
                ec5_77: 'Private project',
                ec5_78: 'Access denied',
                ec5_50: 'JWT Error',
                ec5_51: 'JWT Invalid',
                ec5_136: 'Project up to date',
                ec5_137: 'Project updated'
            }
        }
    }
}));

describe('updateProject()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        const rootStore = useRootStore();
        rootStore.language = 'en';

        // Start with a clean but loaded project model so the update flow guard passes
        projectModel.destroy();
        projectModel.loadExtraStructure({ project: { details: {} } });
    });

    it('locks navigation while the update is in flight and releases it on success', async () => {
        const rootStore = useRootStore();

        let lockSeenDuringUpdate;
        versioningService.updateProject.mockImplementation(async () => {
            lockSeenDuringUpdate = rootStore.isProjectUpdating;
            return true;
        });

        await updateProject();

        expect(lockSeenDuringUpdate).toBe(true);
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(rootStore.nextRoute).toBe(PARAMETERS.ROUTES.ENTRIES);
        expect(notificationService.showAlert).toHaveBeenCalled();
    });

    it('does not resolve before the versioning update has settled', async () => {
        const rootStore = useRootStore();

        let resolveUpdate;
        versioningService.updateProject.mockReturnValue(new Promise((resolve) => {
            resolveUpdate = resolve;
        }));

        const pendingUpdate = updateProject();
        await flushPromises();

        //still in flight: the lock is held and the post-update cleanup has not run
        expect(rootStore.isProjectUpdating).toBe(true);
        expect(entriesDownloadProgressService.clearProject).not.toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).not.toHaveBeenCalled();

        resolveUpdate(true);
        await pendingUpdate;

        expect(rootStore.isProjectUpdating).toBe(false);
        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalled();
    });

    it('releases the navigation lock when the update fails', async () => {
        const rootStore = useRootStore();
        const webError = { data: { errors: [{ code: 'ec5_999' }] } };
        versioningService.updateProject.mockRejectedValue(webError);

        await updateProject();

        expect(errorsService.handleWebError).toHaveBeenCalledWith(webError);
        expect(rootStore.isProjectUpdating).toBe(false);
    });

    it('releases the navigation lock on an auth error and stores the retry callback', async () => {
        const rootStore = useRootStore();
        versioningService.updateProject.mockRejectedValue({
            data: { errors: [{ code: 'ec5_70' }] }
        });

        await updateProject();

        expect(rootStore.afterUserIsLoggedIn.callback).toBeDefined();
        expect(typeof rootStore.afterUserIsLoggedIn.callback).toBe('function');
        expect(logout).toHaveBeenCalled();
        expect(showModalLogin).toHaveBeenCalled();
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);
    });

    it('releases the navigation lock when the stale cleanup fails', async () => {
        const rootStore = useRootStore();
        versioningService.updateProject.mockRejectedValue({
            data: { errors: [{ code: 'ec5_999' }] },
            isStaleCleanupError: true
        });

        await updateProject();

        expect(notificationService.showAlert).toHaveBeenCalled();
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);
    });

    it('never takes the navigation lock when no project is loaded', async () => {
        const rootStore = useRootStore();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        projectModel.destroy();

        await updateProject();

        expect(rootStore.isProjectUpdating).toBe(false);
        expect(versioningService.updateProject).not.toHaveBeenCalled();
        expect(notificationService.showProgressDialog).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });
});
