import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import flushPromises from 'flush-promises';
import ModalProgressTransfer from '@/components/modals/ModalProgressTransfer.vue';
import { notificationService } from '@/services/notification-service';
import { modalController } from '@ionic/vue';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en',
        progressTransfer: {
            total: 10,
            done: 5
        }
    }))
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        confirmSingle: vi.fn(() => Promise.resolve(true))
    }
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        dismiss: vi.fn(() => Promise.resolve())
    }
}));

describe('ModalProgressTransfer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not show a close button by default', () => {
        const wrapper = shallowMount(ModalProgressTransfer, {
            props: {
                header: 'Downloading entries'
            }
        });

        expect(wrapper.find('ion-buttons-stub').exists()).toBe(false);
    });

    it('confirms, calls onClose, and dismisses when the close button is enabled', async () => {
        const onClose = vi.fn();
        const wrapper = shallowMount(ModalProgressTransfer, {
            props: {
                header: 'Downloading entries',
                showCloseButton: true,
                onClose
            }
        });

        await wrapper.vm.closeModal();
        await flushPromises();

        expect(notificationService.confirmSingle).toHaveBeenCalledWith('Are you sure?');
        expect(onClose).toHaveBeenCalled();
        expect(modalController.dismiss).toHaveBeenCalledWith(null, 'cancel');
    });
});
