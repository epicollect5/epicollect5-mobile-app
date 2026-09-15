import ModalEntriesBranchFilter from '@/components/modals/ModalEntriesBranchFilter.vue';
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { databaseSelectService } from '@/services/database/database-select-service';
import { rollbarService } from '@/services/utilities/rollbar-service';
import flushPromises from 'flush-promises';

const DELAY_LONG = PARAMETERS.DELAY_LONG;

function mountFilter() {
    return shallowMount(ModalEntriesBranchFilter, {
        props: {
            countNoFilters: 10,
            countWithFilters: 5,
            filters: { ...PARAMETERS.FILTERS_DEFAULT },
            ownerInputRef: 'input-ref',
            ownerEntryUuid: 'owner-uuid'
        }
    });
}

function mockCountResult(total) {
    return {
        rows: {
            length: 1,
            item: () => ({
                total,
                oldest: '2026-01-01T00:00:00.000Z',
                newest: '2026-02-01T00:00:00.000Z'
            })
        }
    };
}

beforeEach(() => {
    setActivePinia(createPinia());
    vi.resetAllMocks();
    PARAMETERS.DELAY_LONG = 0;
    rollbarService.critical = vi.fn();
});

afterEach(() => {
    PARAMETERS.DELAY_LONG = DELAY_LONG;
});

describe('ModalEntriesBranchFilter count failure', () => {
    it('keeps previous count and dates when countBranchesForQuestion rejects', async () => {
        databaseSelectService.countBranchesForQuestion = vi.fn().mockRejectedValue(new Error('SQLITE_ERROR'));

        const wrapper = mountFilter();
        const previousCount = wrapper.vm.state.count;

        await wrapper.vm.filterByTitle({ target: { value: 'd\'cure' } });
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(rollbarService.critical).toHaveBeenCalledOnce();
        expect(wrapper.vm.state.count).toBe(previousCount);
        expect(wrapper.vm.state.filters.oldest).toBeNull();
        expect(wrapper.vm.state.filters.newest).toBeNull();
        expect(wrapper.vm.state.isFetching).toBe(false);
    });

    it('applies count and dates when countBranchesForQuestion resolves', async () => {
        databaseSelectService.countBranchesForQuestion = vi.fn().mockResolvedValue(mockCountResult(3));

        const wrapper = mountFilter();

        await wrapper.vm.filterByTitle({ target: { value: 'cure' } });
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(rollbarService.critical).not.toHaveBeenCalled();
        expect(wrapper.vm.state.count).toBe(3);
        expect(wrapper.vm.state.filters.oldest).toBe('2026-01-01');
        expect(wrapper.vm.state.filters.newest).toBe('2026-02-01');
        expect(wrapper.vm.state.isFetching).toBe(false);
    });
});
