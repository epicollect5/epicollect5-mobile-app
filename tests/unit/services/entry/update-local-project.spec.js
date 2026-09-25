import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn()
}));

vi.mock('@/services/utilities/versioning-service', () => ({
    versioningService: {
        checkProjectVersion: vi.fn(),
        updateProject: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showAlert: vi.fn().mockResolvedValue(),
        showProgressDialog: vi.fn().mockResolvedValue(),
        hideProgressDialog: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: {
        handleWebError: vi.fn().mockResolvedValue()
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

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        hasInitialised: vi.fn(() => true)
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

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        delay: vi.fn().mockResolvedValue()
    }
}));

import { updateLocalProject } from '@/use/project/update-local-project';
import { useRootStore } from '@/stores/root-store';
import { versioningService } from '@/services/utilities/versioning-service';
import { projectModel } from '@/models/project-model.js';
import { alertController } from '@ionic/vue';
import { showUpdaterModal } from '@/components/modals/ModalProjectUpdater.vue';
import { notificationService } from '@/services/notification-service';

function setupStores() {
    useRootStore.mockReturnValue({
        language: 'en',
        device: { platform: 'android' },
        continueProjectVersionBackgroundCheck: true,
        isProjectUpdating: false,
        isProjectUpdateModalActive: false,
        progressUpdate: { total: 0, done: 0 }
    });
}

function mockConfirm(confirmed) {
    alertController.create.mockImplementation(async () => ({
        present: vi.fn().mockResolvedValue(),
        dismiss: vi.fn().mockResolvedValue(),
        _fire: null
    }));
    // Resolve confirm by invoking the ok/cancel handler directly
    alertController.create.mockImplementation(async (options) => {
        const buttons = options.buttons;
        const target = confirmed
            ? buttons.find((button) => button.text === 'Ok' || button.handler)
            : buttons.find((button) => button.role === 'cancel');
        return {
            present: vi.fn().mockImplementation(async () => {
                if (confirmed) {
                    const ok = buttons[buttons.length - 1];
                    ok.handler();
                } else {
                    target.handler();
                }
            }),
            dismiss: vi.fn().mockResolvedValue()
        };
    });
}

describe('update-local-project', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupStores();
        projectModel.hasInitialised.mockReturnValue(true);
    });

    it('returns UP_TO_DATE without prompting', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(true);

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(alertController.create).not.toHaveBeenCalled();
        expect(versioningService.updateProject).not.toHaveBeenCalled();
    });

    it('returns DECLINED when user cancels', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(false);

        const result = await updateLocalProject();

        expect(result).toBe(false);
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

    it('successful update dismisses updater before returning', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        mockConfirm(true);
        showUpdaterModal.mockResolvedValue({
            modal: {
                onDidDismiss: vi.fn().mockResolvedValue(),
                dismiss: vi.fn().mockResolvedValue()
            }
        });
        versioningService.updateProject.mockResolvedValue(true);

        const result = await updateLocalProject();

        expect(result).toBe(true);
        expect(showUpdaterModal).toHaveBeenCalled();
        expect(notificationService.showAlert).not.toHaveBeenCalled();
    });
});
