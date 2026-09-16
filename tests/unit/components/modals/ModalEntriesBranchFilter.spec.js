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

    it('ignores a stale response when a newer request resolves first', async () => {
        let resolveFirst;
        let resolveSecond;
        databaseSelectService.countBranchesForQuestion = vi.fn()
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

        const wrapper = mountFilter();

        await wrapper.vm.filterByTitle({ target: { value: 'aaa' } });
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(databaseSelectService.countBranchesForQuestion).toHaveBeenCalledTimes(1);

        await wrapper.vm.filterByStatus({ target: { value: PARAMETERS.STATUS.INCOMPLETE } });
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(databaseSelectService.countBranchesForQuestion).toHaveBeenCalledTimes(2);

        //newer request resolves first, then the stale one arrives late
        resolveSecond(mockCountResult(7));
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 10));
        resolveFirst(mockCountResult(2));
        await flushPromises();
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(wrapper.vm.state.count).toBe(7);
        expect(wrapper.vm.state.isFetching).toBe(false);
        expect(rollbarService.critical).not.toHaveBeenCalled();
    });

    it('reset during the debounce window drops the pending title search', async () => {
        databaseSelectService.countBranchesForQuestion = vi.fn().mockResolvedValue(mockCountResult(4));
        PARAMETERS.DELAY_LONG = 20;

        const wrapper = mountFilter();

        await wrapper.vm.filterByTitle({ target: { value: 'd\'cure' } });
        wrapper.vm.resetFilters();
        await new Promise((resolve) => setTimeout(resolve, 80));

        //only the reset query runs, and it must not see the dismissed title
        expect(databaseSelectService.countBranchesForQuestion).toHaveBeenCalledTimes(1);
        expect(databaseSelectService.countBranchesForQuestion.mock.calls[0][2].title).toBe('');
        expect(wrapper.vm.state.filters.title).toBe('');
        expect(wrapper.vm.state.searchbarInitialValue).toBe('');
        expect(wrapper.vm.state.count).toBe(4);
        expect(wrapper.vm.state.isFetching).toBe(false);
    });
});
