import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import ModalProgressEncoding from '@/components/modals/ModalProgressEncoding.vue';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en',
        progressEncoding: {
            done: 0.5
        }
    }))
}));

describe('ModalProgressEncoding', () => {
    it('lets the title inherit the theme text color', () => {
        //color="dark" pins #222428 text in both themes: invisible on the
        //dark modal surface, so the title must not pin any color
        const wrapper = shallowMount(ModalProgressEncoding, {
            props: {
                header: 'Encoding video'
            }
        });

        expect(wrapper.find('ion-title').attributes('color')).toBeUndefined();
    });
});
