import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import ToolbarEntriesFilters from '@/components/ToolbarEntriesFilters.vue';

describe('ToolbarEntriesFilters', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    const factory = (props = {}) => {
        return mount(ToolbarEntriesFilters, {
            props: {
                countNoFilters: 10,
                countWithFilters: 10,
                ...props
            },
            global: {
                stubs: {
                    'ion-item-divider': true,
                    'ion-button': true,
                    'ion-icon': true
                }
            }
        });
    };

    it('emits filters-clear when the clear button is pressed', async () => {
        const wrapper = factory({ countNoFilters: 10, countWithFilters: 5 });
        await wrapper.vm.filtersClear();
        expect(wrapper.emitted('filters-clear')).toBeTruthy();
        expect(wrapper.emitted('filters-clear').length).toBe(1);
    });

    it('shows the filtered count when filters narrow the list', () => {
        const wrapper = factory({ countNoFilters: 10, countWithFilters: 5 });
        expect(wrapper.text()).toContain('5/10');
    });

    it('shows the total count when no filters apply', () => {
        const wrapper = factory({ countNoFilters: 10, countWithFilters: 10 });
        expect(wrapper.text()).toContain('10');
    });
});
