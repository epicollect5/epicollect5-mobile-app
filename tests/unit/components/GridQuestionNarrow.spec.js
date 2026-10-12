import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import GridQuestionNarrow from '@/components/GridQuestionNarrow.vue';

describe('GridQuestionNarrow.vue', () => {
    function columnFor(props = {}) {
        const wrapper = mount(GridQuestionNarrow, {
            props,
            slots: { content: '<div class="content"></div>' }
        });
        return { wrapper, col: wrapper.find('ion-col') };
    }

    it('renders the slotted content in the default 8/12 phone column', () => {
        const { wrapper, col } = columnFor();
        expect(wrapper.find('.content').exists()).toBe(true);
        expect(col.attributes('size-xs')).toBe('8');
        expect(col.attributes('offset-xs')).toBe('2');
    });

    it('spans the full phone column for wide fields', () => {
        //date/time fields must not ellipsize their longest value on phones
        const { col } = columnFor({ wide: true });
        expect(col.attributes('size-xs')).toBe('12');
        expect(col.attributes('offset-xs')).toBe('0');
    });
});
