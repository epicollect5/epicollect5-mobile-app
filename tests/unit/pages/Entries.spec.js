import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import Entries from '@/pages/Entries.vue';
import { fetchEntries } from '@/use/entries/fetch-entries.js';
import { entriesListService } from '@/services/entry/entries-list-service';
import { notificationService } from '@/services/notification-service';
import { updateLocalProject } from '@/use/project/update-local-project';
import { projectModel } from '@/models/project-model.js';
import { databaseSelectService } from '@/services/database/database-select-service';

const routerReplace = vi.hoisted(() => vi.fn());
const rollbarMock = vi.hoisted(() => ({ critical: vi.fn(), criticalWithContext: vi.fn() }));

vi.mock('vue-router', async () => {
    const { reactive } = await import('vue');
    const route = reactive({ query: {}, name: 'entries' });
    globalThis.__entriesTestRoute = route;
    return {
        useRouter: () => ({
            replace: routerReplace
        }),
        useRoute: () => globalThis.__entriesTestRoute
    };
});

vi.mock('@ionic/vue', () => ({
    menuController: {
        open: vi.fn()
    },
    useBackButton: vi.fn(),
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('ionicons/icons', () => ({
    cloudUpload: 'cloudUpload',
    add: 'add',
    chevronBackOutline: 'chevronBackOutline',
    ellipsisVertical: 'ellipsisVertical'
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getProjectRef: vi.fn(() => 'p1'),
        hasInitialised: vi.fn(() => true),
        getExtraForm: vi.fn(() => ({ details: { name: 'Form' } })),
        getFirstFormRef: vi.fn(() => 'form-a'),
        getFormRefsInOrder: vi.fn(() => ['form-a']),
        getNextFormRef: vi.fn(() => ''),
        getParentFormRef: vi.fn(() => ''),
        getFormName: vi.fn(() => ''),
        initialise: vi.fn(),
        destroy: vi.fn()
    }
}));

vi.mock('@/models/form-model.js', () => ({
    formModel: {
        formRef: '',
        initialise: vi.fn(),
        destroy: vi.fn()
    }
}));

vi.mock('@/use/project/update-local-project', () => ({
    updateLocalProject: vi.fn().mockResolvedValue(false)
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        selectProject: vi.fn()
    }
}));

vi.mock('@/use/entries/fetch-entries.js', () => ({
    fetchEntries: vi.fn()
}));

vi.mock('@/use/entries/add-fake-entries', () => ({
    addFakeEntries: vi.fn().mockResolvedValue()
}));

vi.mock('@/services/entry/entry-service', () => ({
    entryService: {
        setUpNew: vi.fn()
    }
}));

vi.mock('@/services/utilities/location-cordova-service', () => ({
    locationService: {
        stopWatching: vi.fn()
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        delay: vi.fn().mockResolvedValue(),
        objectsMatch: (first, second) => JSON.stringify(first) === JSON.stringify(second),
        getProjectNameMarkup: vi.fn(() => 'project')
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn().mockResolvedValue(),
        hideProgressDialog: vi.fn().mockResolvedValue(),
        showAlert: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/utilities/rollbar-service', () => ({ rollbarService: rollbarMock }));

vi.mock('@/services/entry/entries-list-service', () => ({
    entriesListService: {
        setActiveForm: vi.fn(),
        getFilterCounts: vi.fn()
    }
}));

function mockListData() {
    entriesListService.setActiveForm.mockReturnValue({
        formRef: 'form-a',
        parentEntryUuid: '',
        parentEntryName: '',
        currentFormName: 'Form A',
        nextFormRef: '',
        parentFormRef: '',
        parentFormName: '',
        backLabel: 'Projects',
        bookmarkId: null,
        resetHierarchy: false
    });
    entriesListService.getFilterCounts.mockResolvedValue({
        countNoFilters: 1,
        countWithFilters: 1,
        filters: { title: '' }
    });
    fetchEntries.mockResolvedValue({
        entries: [{ entry_uuid: 'e1' }],
        branchMediaUuids: [],
        allMediaUuids: ['e1'],
        hasUnsyncedEntries: false
    });
}

describe('Entries page pump', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.__entriesTestRoute.query = {};
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.routeParams = { projectRef: 'p1', formRef: 'form-a' };
        rootStore.hierarchyNavigation = [];
        useBookmarkStore().bookmarks = [];
        mockListData();
    });

    it('loads the list on mount', async () => {
        const wrapper = shallowMount(Entries);
        await flushPromises();
        await flushPromises();
        expect(fetchEntries).toHaveBeenCalledTimes(1);
        expect(wrapper.vm.state.entries).toEqual([{ entry_uuid: 'e1' }]);
        expect(wrapper.vm.state.isFetching).toBe(false);
    });

    it('child-form back navigates and reloads the parent', async () => {
        const wrapper = shallowMount(Entries);
        await flushPromises();
        await flushPromises();
        expect(wrapper.vm.state.isFetching).toBe(false);

        wrapper.vm.state.parentFormRef = 'form-a';
        const rootStore = useRootStore();
        rootStore.hierarchyNavigation = [{ parentEntryUuid: 'p', parentEntryName: 'P' }];
        rootStore.routeParams = { projectRef: 'p1', formRef: 'form-a' };
        fetchEntries.mockClear();

        await wrapper.vm.goBack();
        expect(routerReplace).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
                refreshEntries: 'true',
                timestamp: expect.any(Number)
            }
        });

        globalThis.__entriesTestRoute.query = { refreshEntries: 'true', timestamp: Date.now() };
        await flushPromises();
        await flushPromises();
        expect(fetchEntries).toHaveBeenCalled();
    });

    it('reports failed loads to rollbar', async () => {
        fetchEntries.mockRejectedValueOnce(new Error('db gone'));
        shallowMount(Entries);
        await flushPromises();
        await flushPromises();
        expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('Entries list load failed', expect.any(Error));
    });

    it('syncs routeParams to the first form after a post-update reset', async () => {
        const rootStore = useRootStore();
        rootStore.routeParams = { projectRef: 'p1', formRef: 'form-child' };
        rootStore.hierarchyNavigation = [{ parentEntryUuid: 'p', parentEntryName: 'P' }];
        projectModel.hasInitialised.mockReturnValueOnce(false);
        databaseSelectService.selectProject.mockResolvedValueOnce({
            rows: { length: 1, item: () => ({ projectRef: 'p1' }) }
        });
        updateLocalProject.mockResolvedValueOnce(true);

        shallowMount(Entries);
        await flushPromises();
        await flushPromises();
        await flushPromises();

        expect(fetchEntries).toHaveBeenCalledTimes(2);
        expect(rootStore.routeParams.formRef).toBe('form-a');
        expect(rootStore.hierarchyNavigation).toEqual([]);
    });
});
