import { vi, describe, it, expect, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { versioningService } from '@/services/utilities/versioning-service';
import { notificationService } from '@/services/notification-service';
import { updateLocalProject } from '@/use/project/update-local-project';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { errorsService } from '@/services/errors-service';
import { projectModel } from '@/models/project-model';
import { alertController } from '@ionic/vue';
import { showUpdaterModal } from '@/components/modals/ModalProjectUpdater.vue';

vi.mock('@/services/utilities/versioning-service', () => ({
    versioningService: {
        checkProjectVersion: vi.fn(),
        updateProject: vi.fn()
    }
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

vi.mock('@/config', () => ({
    PARAMETERS: {
        AUTH_ERROR_CODES: ['ec5_70', 'ec5_71', 'ec5_77', 'ec5_78', 'ec5_50', 'ec5_51'],
        UPDATE_PROJECT_DOCS_URL: 'https://docs.epicollect.net/mobile-application/updating-a-project-mobile'
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                wait: 'wait',
                updating_project: 'updating',
                loading_entries: 'loading',
                update_project: 'update',
                project_outdated: 'outdated',
                learn_more: 'Learn More',
                cancel: 'Cancel',
                ok: 'Ok',
                error: 'Error',
                stale_cleanup_failed: 'cleanup failed'
            },
            status_codes: {
                ec5_70: 'Please log in',
                ec5_71: 'Permission denied',
                ec5_77: 'Private project',
                ec5_78: 'Access denied',
                ec5_50: 'JWT Error',
                ec5_51: 'JWT Invalid'
            }
        }
    }
}));

vi.mock('@ionic/vue', () => ({
    alertController: {
        create: vi.fn()
    }
}));

vi.mock('@/components/modals/ModalProjectUpdater.vue', () => ({
    showUpdaterModal: vi.fn()
}));

function mockConfirm(confirmed) {
    alertController.create.mockImplementation(async (options) => {
        const buttons = options.buttons;
        return {
            present: vi.fn().mockImplementation(async () => {
                if (confirmed) {
                    const ok = buttons[buttons.length - 1];
                    ok.handler();
                } else {
                    const cancel = buttons.find((button) => button.role === 'cancel');
                    cancel.handler();
                }
            }),
            dismiss: vi.fn().mockResolvedValue()
        };
    });
}

describe('updateLocalProject()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.device = { platform: 'android' };
        rootStore.continueProjectVersionBackgroundCheck = true;

        projectModel.destroy();
        projectModel.loadExtraStructure({ project: { details: {} } });
        showUpdaterModal.mockResolvedValue({
            modal: {
                onDidDismiss: vi.fn().mockResolvedValue(),
                dismiss: vi.fn().mockResolvedValue()
            }
        });
    });

    it('returns UP_TO_DATE immediately if project is up to date', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(true);

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(versioningService.checkProjectVersion).toHaveBeenCalled();
        expect(alertController.create).not.toHaveBeenCalled();
    });

    it('asks for confirmation and returns DECLINED if user cancels', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(false);

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(alertController.create).toHaveBeenCalled();
        expect(versioningService.updateProject).not.toHaveBeenCalled();
    });

    it('updates project and returns UPDATED when confirmed', async () => {
        const rootStore = useRootStore();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        rootStore.continueProjectVersionBackgroundCheck = true;
        mockConfirm(true);
        versioningService.updateProject.mockResolvedValue(true);

        const result = await updateLocalProject();

        expect(result).toBe(true);
        expect(alertController.create).toHaveBeenCalled();
    });

    it('locks hardware back while confirmation is pending', async () => {
        const rootStore = useRootStore();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        let confirmButtons;
        alertController.create.mockImplementation(async (options) => {
            confirmButtons = options.buttons;
            return {
                present: vi.fn().mockResolvedValue(),
                dismiss: vi.fn().mockResolvedValue()
            };
        });
        const pending = updateLocalProject();
        await flushPromises();
        expect(rootStore.isProjectUpdating).toBe(true);
        const cancel = confirmButtons.find((button) => button.role === 'cancel');
        cancel.handler();
        const result = await pending;
        expect(result).toBe(false);
        expect(rootStore.isProjectUpdating).toBe(false);
    });

    it('shows first auth error without login retry (fail-fast)', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(true);
        versioningService.updateProject.mockRejectedValue({
            data: { errors: [{ code: 'ec5_70' }] }
        });

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(notificationService.showAlert).toHaveBeenCalled();
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
    });

    it('returns UP_TO_DATE and logs error if checkProjectVersion fails', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        versioningService.checkProjectVersion.mockRejectedValue(new Error('Network Fail'));

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('handles non-auth errors using errorsService.handleWebError', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(true);
        const regularError = {
            data: { errors: [{ code: 'ec5_999' }] }
        };
        versioningService.updateProject.mockRejectedValue(regularError);

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(errorsService.handleWebError).toHaveBeenCalledWith(regularError);
    });

    it('shows stale cleanup failed alert when isStaleCleanupError is set', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(true);
        versioningService.updateProject.mockRejectedValue({ isStaleCleanupError: true });

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(notificationService.showAlert).toHaveBeenCalledWith(
            STRINGS.en.labels.stale_cleanup_failed,
            STRINGS.en.labels.error
        );
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
    });

    it('locks navigation while the update is in flight and releases it on success', async () => {
        const rootStore = useRootStore();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(true);

        let seenDuringUpdate;
        versioningService.updateProject.mockImplementation(async () => {
            seenDuringUpdate = rootStore.isProjectUpdating;
            return true;
        });

        const result = await updateLocalProject();

        expect(result).toBe(true);
        expect(seenDuringUpdate).toBe(true);
        expect(rootStore.isProjectUpdating).toBe(false);
    });

    it('releases the navigation lock when the update fails', async () => {
        const rootStore = useRootStore();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(true);
        versioningService.updateProject.mockRejectedValue({
            data: { errors: [{ code: 'ec5_999' }] }
        });

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(rootStore.isProjectUpdating).toBe(false);
    });

    it('never sets the navigation lock when no update runs', async () => {
        const rootStore = useRootStore();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(false);

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(versioningService.updateProject).not.toHaveBeenCalled();
    });

    it('updater presentation failure never starts update', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(true);
        showUpdaterModal.mockRejectedValue(new Error('present failed'));

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(versioningService.updateProject).not.toHaveBeenCalled();
    });
});
