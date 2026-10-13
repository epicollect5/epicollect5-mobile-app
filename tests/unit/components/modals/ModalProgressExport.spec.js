import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import ModalProgressExport from '@/components/modals/ModalProgressExport.vue';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en',
        progressExport: {
            total: 10,
            done: 5
        }
    }))
}));

describe('ModalProgressExport', () => {
    it('lets the title inherit the theme text color', () => {
        //color="dark" pins #222428 text in both themes: invisible on the
        //dark modal surface, so the title must not pin any color
        const wrapper = shallowMount(ModalProgressExport, {
            props: {
                header: 'Exporting'
            }
        });

        expect(wrapper.find('ion-title').attributes('color')).toBeUndefined();
    });
});
