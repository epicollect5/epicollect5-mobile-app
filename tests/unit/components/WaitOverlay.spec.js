import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import WaitOverlay from '@/components/globals/WaitOverlay.vue';
import { useWaitOverlayStore } from '@/stores/wait-overlay-store';

describe('WaitOverlay.vue', () => {
    let wrapper;
    let store;

    const factory = () => {
        //one pinia shared by the test and the component, so the store state
        //the test mutates is the one the overlay renders from
        const pinia = createPinia();
        setActivePinia(pinia);
        wrapper = mount(WaitOverlay, {
            global: {
                pinia
            }
        });
        store = useWaitOverlayStore();
        return wrapper;
    };

    beforeEach(() => {
        wrapper = null;
        store = null;
    });

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount();
        }
    });

    it('renders nothing while no operation is in flight', () => {
        wrapper = factory();
        expect(wrapper.find('.wait-overlay--shown').exists()).toBe(false);
    });

    it('shows the full screen overlay while an operation is in flight', async () => {
        factory();

        store.show();
        await nextTick();

        expect(wrapper.find('.wait-overlay--shown').exists()).toBe(true);
        expect(wrapper.find('.wait-overlay').exists()).toBe(true);
    });

    it('paints the veil at the opacity the caller asked for', async () => {
        factory();

        //a geocode asks for a light veil, an upload leaves it at the default
        store.show(0.2);
        await nextTick();
        expect(wrapper.find('.wait-overlay').attributes('style')).toContain('rgba(255, 255, 255, 0.2)');

        store.dismiss();
        store.show();
        await nextTick();
        expect(wrapper.find('.wait-overlay').attributes('style')).toContain('rgba(255, 255, 255, 0.5)');
    });

    it('hides the overlay again on dismiss', async () => {
        factory();

        store.show();
        await nextTick();
        store.dismiss();
        await nextTick();

        expect(wrapper.find('.wait-overlay--shown').exists()).toBe(false);
        //the node stays in the DOM, just not shown
        expect(wrapper.find('.wait-overlay').exists()).toBe(true);
    });
});
