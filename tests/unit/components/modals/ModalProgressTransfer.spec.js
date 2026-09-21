import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import flushPromises from 'flush-promises';
import ModalProgressTransfer from '@/components/modals/ModalProgressTransfer.vue';
import { notificationService } from '@/services/notification-service';

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
        confirmSingle: vi.fn(() => Promise.resolve(true)),
        dismissModalSafe: vi.fn(() => Promise.resolve())
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
        const calls = [];
        const onClose = vi.fn(async () => {
            calls.push('onClose');
        });
        notificationService.dismissModalSafe.mockImplementationOnce(() => {
            calls.push('dismiss');
            return Promise.resolve();
        });
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
        expect(notificationService.dismissModalSafe).toHaveBeenCalledWith(null, 'cancel');
        expect(calls).toEqual(['onClose', 'dismiss']);
    });

    it('resolves after a double dismiss (modal already gone)', async () => {
        //the real dismissModalSafe swallows "overlay does not exist" and
        //resolves; the mock mirrors that contract for the ✕-then-service
        //dismiss race on entries-download
        notificationService.dismissModalSafe.mockResolvedValueOnce();
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

        expect(onClose).toHaveBeenCalled();
        expect(notificationService.dismissModalSafe).toHaveBeenCalledWith(null, 'cancel');
    });

    it('does not call onClose or dismiss when close confirmation is cancelled', async () => {
        notificationService.confirmSingle.mockResolvedValueOnce(false);
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
        expect(onClose).not.toHaveBeenCalled();
        expect(notificationService.dismissModalSafe).not.toHaveBeenCalled();
    });
});
