import ModalEntriesFilter from '@/components/modals/ModalEntriesFilter.vue';
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { databaseSelectService } from '@/services/database/database-select-service';
import { rollbarService } from '@/services/utilities/rollbar-service';
import flushPromises from 'flush-promises';

function mountFilter(filterOverrides = {}) {
    return shallowMount(ModalEntriesFilter, {
        props: {
            countNoFilters: 10,
            countWithFilters: 5,
            filters: { ...PARAMETERS.FILTERS_DEFAULT, ...filterOverrides },
            projectRef: 'project-ref',
            formRef: 'form-ref',
            parentEntryUuid: ''
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
    vi.useFakeTimers();
    setActivePinia(createPinia());
    vi.resetAllMocks();
    PARAMETERS.DELAY_LONG = 0;
    rollbarService.critical = vi.fn();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ModalEntriesFilter count failure', () => {
    it('keeps previous count and dates when countEntries rejects', async () => {
        databaseSelectService.countEntries = vi.fn().mockRejectedValue(new Error('SQLITE_ERROR'));

        const wrapper = mountFilter();
        const previousCount = wrapper.vm.state.count;

        await wrapper.vm.filterByTitle({ target: { value: 'd\'cure' } });
        await vi.advanceTimersByTimeAsync(PARAMETERS.DELAY_LONG);
        await flushPromises();

        expect(rollbarService.critical).toHaveBeenCalledOnce();
        expect(wrapper.vm.state.count).toBe(previousCount);
        expect(wrapper.vm.state.filters.oldest).toBeNull();
        expect(wrapper.vm.state.filters.newest).toBeNull();
        expect(wrapper.vm.state.isFetching).toBe(false);
    });

    it('applies count and dates when countEntries resolves', async () => {
        databaseSelectService.countEntries = vi.fn().mockResolvedValue(mockCountResult(3));

        const wrapper = mountFilter();

        await wrapper.vm.filterByTitle({ target: { value: 'cure' } });
        await vi.advanceTimersByTimeAsync(PARAMETERS.DELAY_LONG);
        await flushPromises();

        expect(rollbarService.critical).not.toHaveBeenCalled();
        expect(wrapper.vm.state.count).toBe(3);
        expect(wrapper.vm.state.filters.oldest).toBe('2026-01-01');
        expect(wrapper.vm.state.filters.newest).toBe('2026-02-01');
        expect(wrapper.vm.state.isFetching).toBe(false);
    });

    it('ignores a stale response when a newer request resolves first', async () => {
        let resolveFirst;
        let resolveSecond;
        databaseSelectService.countEntries = vi.fn()
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

        const wrapper = mountFilter();

        await wrapper.vm.filterByTitle({ target: { value: 'aaa' } });
        await vi.advanceTimersByTimeAsync(PARAMETERS.DELAY_LONG);
        expect(databaseSelectService.countEntries).toHaveBeenCalledTimes(1);

        await wrapper.vm.filterByStatus({ target: { value: PARAMETERS.STATUS.INCOMPLETE } });
        await vi.advanceTimersByTimeAsync(PARAMETERS.DELAY_LONG);
        expect(databaseSelectService.countEntries).toHaveBeenCalledTimes(2);

        //newer request resolves first, then the stale one arrives late
        resolveSecond(mockCountResult(7));
        await flushPromises();
        resolveFirst(mockCountResult(2));
        await flushPromises();

        expect(wrapper.vm.state.count).toBe(7);
        expect(wrapper.vm.state.isFetching).toBe(false);
        expect(rollbarService.critical).not.toHaveBeenCalled();
    });

    it('reset during the debounce window drops the pending title search', async () => {
        databaseSelectService.countEntries = vi.fn().mockResolvedValue(mockCountResult(4));
        PARAMETERS.DELAY_LONG = 500;

        const wrapper = mountFilter();

        await wrapper.vm.filterByTitle({ target: { value: 'd\'cure' } });
        wrapper.vm.resetFilters();
        await vi.advanceTimersByTimeAsync(500);
        await flushPromises();

        //only the reset query runs, and it must not see the dismissed title
        expect(databaseSelectService.countEntries).toHaveBeenCalledTimes(1);
        expect(databaseSelectService.countEntries.mock.calls[0][3].title).toBe('');
        expect(wrapper.vm.state.filters.title).toBe('');
        expect(wrapper.vm.state.searchbarInitialValue).toBe('');
        expect(wrapper.vm.state.count).toBe(4);
        expect(wrapper.vm.state.isFetching).toBe(false);
    });
});

describe('ModalEntriesFilter date fields', () => {
    it('renders shared date-time-fields for from and to with min and max', () => {
        const wrapper = mountFilter({ oldest: '2026-01-01', newest: '2026-02-01' });
        //shallowMount stubs the local DateTimeField: assert both fields exist
        //and each keeps its bounds, otherwise a missing field or a lost
        //min/max binding still passes a single substring check
        const fields = wrapper.findAllComponents({ name: 'DateTimeField' });
        expect(fields.length).toBe(2);
        for (const field of fields) {
            expect(field.props('type')).toBe('date');
            expect(field.props('min')).toBe('2026-01-01');
            expect(field.props('max')).toBe('2026-02-01');
        }
        expect(wrapper.vm.onFromChange).toBeDefined();
        expect(wrapper.vm.onToChange).toBeDefined();
    });

    it('updates from and re-filters on change', async () => {
        databaseSelectService.countEntries = vi.fn().mockResolvedValue(mockCountResult(3));
        const wrapper = mountFilter();

        wrapper.vm.onFromChange('2026-01-15T00:00:00.000');
        expect(wrapper.vm.state.filters.from).toBe('2026-01-15');
        await vi.advanceTimersByTimeAsync(PARAMETERS.DELAY_LONG);
        await flushPromises();
        expect(databaseSelectService.countEntries).toHaveBeenCalled();
    });

    it('clears from and re-filters on clear', async () => {
        databaseSelectService.countEntries = vi.fn().mockResolvedValue(mockCountResult(3));
        const wrapper = mountFilter();

        wrapper.vm.onFromClear();
        expect(wrapper.vm.state.filters.from).toBeNull();
        //the scheduled re-count must run: clearing must still re-filter
        await vi.advanceTimersByTimeAsync(PARAMETERS.DELAY_LONG);
        await flushPromises();
        expect(databaseSelectService.countEntries).toHaveBeenCalled();
    });
});
