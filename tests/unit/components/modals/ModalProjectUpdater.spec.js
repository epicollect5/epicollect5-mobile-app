import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ModalProjectUpdater from '@/components/modals/ModalProjectUpdater.vue';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('ionicons/icons', () => ({
    checkmark: 'checkmark'
}));

describe('ModalProjectUpdater', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.progressUpdate = { total: 0, done: 0 };
        rootStore.updateDone = false;
        STRINGS.en.status_codes = { ec5_137: 'done-message' };
    });

    it('fades the progress phase in', () => {
        const wrapper = mount(ModalProjectUpdater, {
            props: { header: 'Updating project' }
        });
        const progress = wrapper.find('.progress-update');
        expect(progress.exists()).toBe(true);
        expect(progress.classes()).toContain('animate__fadeIn');
    });

    it('fades the done phase in instead of snapping', async () => {
        const rootStore = useRootStore();
        const wrapper = mount(ModalProjectUpdater, {
            props: { header: 'Updating project' }
        });
        rootStore.updateDone = true;
        await wrapper.vm.$nextTick();
        expect(wrapper.html()).toContain('done-message');
        const done = wrapper.find('.updater-body > .animate__fadeIn');
        expect(done.exists()).toBe(true);
        expect(done.classes()).toContain('animate__animated');
        expect(done.classes()).toContain('animate__fadeIn');
    });
});
