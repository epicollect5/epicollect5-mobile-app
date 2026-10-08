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
import { confirmProjectUpdate } from '@/use/project/confirm-project-update.js';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { errorsService } from '@/services/errors-service';
import { projectModel } from '@/models/project-model';
import { modalController } from '@ionic/vue';

vi.mock('@/services/utilities/versioning-service', () => ({
    versioningService: {
        updateProject: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
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
vi.mock('@/use/project/confirm-project-update.js', () => ({
    confirmProjectUpdate: vi.fn()
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        AUTH_ERROR_CODES: ['ec5_70', 'ec5_71', 'ec5_77', 'ec5_78', 'ec5_50', 'ec5_51'],
        DELAY_LONG: 1
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                updating_project_title: 'Updating project',
                stale_cleanup_failed: 'stale cleanup failed',
                error: 'Error'
            },
            status_codes: {
                ec5_70: 'Please log in'
            }
        }
    }
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        delay: vi.fn().mockResolvedValue()
    }
}));

//present the updater and hand back its modal controls
function mockModal() {
    const modal = {
        present: vi.fn().mockResolvedValue(),
        onDidDismiss: vi.fn().mockResolvedValue(),
        dismiss: vi.fn().mockResolvedValue()
    };
    modalController.create.mockResolvedValue(modal);
    return modal;
}

describe('updateProject()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        const rootStore = useRootStore();
        rootStore.language = 'en';

        // Start with a clean but loaded project model so the update flow guard passes
        projectModel.destroy();
        projectModel.loadExtraStructure({ project: { details: {} } });

        confirmProjectUpdate.mockResolvedValue(true);
        versioningService.updateProject.mockResolvedValue(true);
    });

    it('never prompts nor takes the navigation lock when no project is loaded', async () => {
        const rootStore = useRootStore();
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        projectModel.destroy();

        const result = await updateProject();

        expect(result).toBe(false);
        expect(confirmProjectUpdate).not.toHaveBeenCalled();
        expect(versioningService.updateProject).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);

        warnSpy.mockRestore();
    });

    it('does not present the updater when the user declines the prompt', async () => {
        const rootStore = useRootStore();
        confirmProjectUpdate.mockResolvedValue(false);

        const result = await updateProject();

        expect(result).toBe(false);
        expect(modalController.create).not.toHaveBeenCalled();
        expect(versioningService.updateProject).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(rootStore.updateDone).toBe(false);
    });

    it('never starts the update when the updater fails to present', async () => {
        const rootStore = useRootStore();
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        modalController.create.mockRejectedValue(new Error('present failed'));

        const result = await updateProject();

        expect(result).toBe(false);
        expect(versioningService.updateProject).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);

        logSpy.mockRestore();
    });

    it('shows progress, flips to the done phase and waits for OK before resolving', async () => {
        const rootStore = useRootStore();
        const modal = mockModal();
        let updateDoneSeen;
        modal.onDidDismiss.mockImplementation(async () => {
            updateDoneSeen = rootStore.updateDone;
        });
        versioningService.updateProject.mockResolvedValue(true);
        const projectRef = projectModel.getProjectRef();

        const result = await updateProject();

        expect(confirmProjectUpdate).toHaveBeenCalledTimes(1);
        expect(modalController.create).toHaveBeenCalledTimes(1);
        expect(modalController.create.mock.calls[0][0].componentProps).toEqual({
            header: STRINGS.en.labels.updating_project_title
        });
        expect(updateDoneSeen).toBe(true);
        expect(result).toBe(true);
        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalledWith(projectRef);
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(rootStore.updateDone).toBe(false);
    });

    it('locks navigation while the update is in flight and releases it on success', async () => {
        const rootStore = useRootStore();
        mockModal();

        let lockSeenDuringUpdate;
        versioningService.updateProject.mockImplementation(async () => {
            lockSeenDuringUpdate = rootStore.isProjectUpdating;
            return true;
        });

        await updateProject();

        expect(lockSeenDuringUpdate).toBe(true);
        expect(rootStore.isProjectUpdating).toBe(false);
    });

    it('does not resolve before the versioning update has settled', async () => {
        const rootStore = useRootStore();
        mockModal();

        let resolveUpdate;
        versioningService.updateProject.mockReturnValue(new Promise((resolve) => {
            resolveUpdate = resolve;
        }));

        const pendingUpdate = updateProject();
        await flushPromises();

        //still in flight: the lock is held and the post-update cleanup has not run
        expect(rootStore.isProjectUpdating).toBe(true);
        expect(entriesDownloadProgressService.clearProject).not.toHaveBeenCalled();

        resolveUpdate(true);
        await pendingUpdate;

        expect(rootStore.isProjectUpdating).toBe(false);
        expect(entriesDownloadProgressService.clearProject).toHaveBeenCalled();
    });

    it('dismisses the updater and releases the navigation lock when the update fails', async () => {
        const rootStore = useRootStore();
        const modal = mockModal();
        const webError = { data: { errors: [{ code: 'ec5_999' }] } };
        versioningService.updateProject.mockRejectedValue(webError);

        const result = await updateProject();

        expect(modal.dismiss).toHaveBeenCalledTimes(1);
        expect(errorsService.handleWebError).toHaveBeenCalledWith(webError);
        expect(entriesDownloadProgressService.clearProject).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(result).toBe(false);
    });

    it('releases the navigation lock on an auth error and stores the retry callback', async () => {
        const rootStore = useRootStore();
        mockModal();
        versioningService.updateProject.mockRejectedValue({
            data: { errors: [{ code: 'ec5_70' }] }
        });

        const result = await updateProject();

        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS.en.status_codes.ec5_70);
        expect(rootStore.afterUserIsLoggedIn.callback).toBe(updateProject);
        expect(logout).toHaveBeenCalled();
        expect(showModalLogin).toHaveBeenCalled();
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(result).toBe(false);
    });

    it('reports the stale cleanup failure without a generic web error', async () => {
        const rootStore = useRootStore();
        mockModal();
        versioningService.updateProject.mockRejectedValue({
            data: { errors: [{ code: 'ec5_999' }] },
            isStaleCleanupError: true
        });

        const result = await updateProject();

        expect(notificationService.showAlert).toHaveBeenCalledWith(
            STRINGS.en.labels.stale_cleanup_failed,
            STRINGS.en.labels.error
        );
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(result).toBe(false);
    });
});
