import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { modalController } from '@ionic/vue';
import ModalProjectUpdater from '@/components/modals/ModalProjectUpdater.vue';
import { showUpdaterModal, cleanupUpdateModal } from '@/use/project/show-updater-modal.js';
import { useRootStore } from '@/stores/root-store';

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('ionicons/icons', () => ({
    checkmark: 'checkmark'
}));

describe('showUpdaterModal()', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('presents the SFC default export (which carries the compiled render) with the given title', async () => {
        const present = vi.fn().mockResolvedValue();
        modalController.create.mockResolvedValue({ present });
        const rootStore = useRootStore();

        const handle = await showUpdaterModal('Updating project');

        expect(modalController.create).toHaveBeenCalledTimes(1);
        const options = modalController.create.mock.calls[0][0];
        expect(options.cssClass).toBe('modal-project-updater');
        expect(options.backdropDismiss).toBe(false);
        expect(options.componentProps).toEqual({ header: 'Updating project' });
        //regression: the modal must receive the SFC default export, never a
        //bare object closed over inside the .vue file - the default export is
        //the only binding the build keeps the compiled template render on
        expect(options.component).toBe(ModalProjectUpdater);
        expect(present).toHaveBeenCalledTimes(1);
        expect(handle).toEqual({ modal: await modalController.create.mock.results[0].value });
        expect(rootStore.isProjectUpdateModalActive).toBe(true);
    });

    it('dismisses the modal and resets the shared updater state on cleanup', async () => {
        const rootStore = useRootStore();
        const dismiss = vi.fn().mockResolvedValue();
        rootStore.isProjectUpdating = true;
        rootStore.isProjectUpdateModalActive = true;
        rootStore.progressUpdate = { total: 4, done: 2 };
        rootStore.updateDone = true;

        await cleanupUpdateModal({ modal: { dismiss } });

        expect(dismiss).toHaveBeenCalledTimes(1);
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(rootStore.isProjectUpdateModalActive).toBe(false);
        expect(rootStore.progressUpdate).toEqual({ total: 0, done: 0 });
        expect(rootStore.updateDone).toBe(false);
    });

    it('resets the shared updater state without a modal handle', async () => {
        const rootStore = useRootStore();
        rootStore.isProjectUpdating = true;
        rootStore.updateDone = true;

        await cleanupUpdateModal(null);

        expect(modalController.dismiss).not.toHaveBeenCalled();
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(rootStore.updateDone).toBe(false);
    });
});
