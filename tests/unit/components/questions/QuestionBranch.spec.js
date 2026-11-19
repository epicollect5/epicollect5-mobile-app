import {mount, flushPromises} from '@vue/test-utils';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import {useRootStore} from '@/stores/root-store';
import QuestionBranch from '@/components/questions/QuestionBranch.vue';
import BranchPwa from '@/components/platform/BranchPwa.vue';
import {branchEntryService} from '@/services/entry/branch-entry-service';
import {branchEntriesFilterService} from '@/services/entry/branch-entries-filter-service';
import {fetchBranchEntries} from '@/use/entries/fetch-branch-entries';
import {PARAMETERS} from '@/config';

vi.mock('@/services/entry/question-common-service', () => ({
    questionCommonService: {
        setUpInputParams: vi.fn()
    }
}));

vi.mock('@/services/entry/branch-entry-service', () => ({
    branchEntryService: {
        setUpNew: vi.fn(),
        setUpExisting: vi.fn(() => Promise.resolve())
    }
}));

vi.mock('@/services/entry/branch-entries-filter-service', () => ({
    branchEntriesFilterService: {
        getBranchFilterCounts: vi.fn()
    }
}));

vi.mock('@/use/entries/fetch-branch-entries', () => ({
    fetchBranchEntries: vi.fn()
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(() => Promise.resolve()),
        hideProgressDialog: vi.fn()
    }
}));

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        objectsMatch: (first, second) => JSON.stringify(first) === JSON.stringify(second),
        getInputFormattedDate: vi.fn((value) => value)
    }
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getProjectRef: vi.fn(() => 'p1')
    }
}));

//the owner-url restore reads the route snapshot and restores the address bar
//after the replace resolves
const {routerMock} = vi.hoisted(() => ({routerMock: {}}));
vi.mock('vue-router', () => ({
    useRouter: () => routerMock,
    useRoute: () => ({params: {}})
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn(() => Promise.resolve())
    }
}));

const ION_STUBS = {
    'ion-item': {template: '<div><slot /></div>'},
    'ion-label': {template: '<div><slot /></div>'},
    'ion-button': {template: '<div><slot /></div>'},
    'ion-icon': true,
    'ion-item-divider': {template: '<div><slot /></div>'},
    'ion-card': {template: '<div><slot /></div>'},
    'ion-card-header': {template: '<div><slot /></div>'},
    'ion-card-title': {template: '<div><slot /></div>'},
    'ion-card-content': {template: '<div><slot /></div>'},
    'ion-grid': {template: '<div><slot /></div>'},
    'ion-row': {template: '<div><slot /></div>'},
    'ion-col': {template: '<div><slot /></div>'},
    'ion-list': {template: '<div><slot /></div>'},
    'ion-infinite-scroll': {template: '<div><slot /></div>'},
    'ion-infinite-scroll-content': true,
    'ion-spinner': true
};

const OWNER_URL = '/pwa/project/test/edit-entry?uuid=owner-uuid';

function seedStore() {
    const rootStore = useRootStore();
    rootStore.language = 'en';
    rootStore.device = {platform: PARAMETERS.ANDROID};
    rootStore.entriesAddScope = {
        entryService: {
            entry: {
                entryUuid: 'owner-uuid',
                formRef: 'form-1',
                isRemote: false
            },
            action: PARAMETERS.ENTRY_ADD
        },
        entryServiceEntry: {}
    };
    return rootStore;
}

//the editBranchPWA logic lives in the pwa variant; the wrapper only seeds
//the shared question state and dispatches on isPWA
function pwaVm(wrapper) {
    return wrapper.findComponent(BranchPwa).vm;
}

//one branch entry as rendered in the branches list, for editBranchPWA
function seedBranchEntries(wrapper) {
    wrapper.vm.state.branchEntries = [
        {
            id: 'branch-uuid-1',
            relationships: {
                branch: {
                    data: {owner_entry_uuid: 'owner-uuid', owner_input_ref: 'input-ref'}
                }
            },
            branch_entry: {
                created_at: '2024-01-01 10:00:00',
                title: 'Branch A',
                answers: {}
            }
        }
    ];
}

async function factory() {
    branchEntriesFilterService.getBranchFilterCounts.mockResolvedValue({
        countNoFilters: 1,
        countWithFilters: 1,
        filters: {...PARAMETERS.FILTERS_DEFAULT}
    });
    fetchBranchEntries.mockResolvedValue({branchEntries: [], hasUnsavedBranches: false});
    const wrapper = mount(QuestionBranch, {
        props: {
            inputRef: 'input-ref',
            type: 'branch',
            parentEntryName: 'Parent',
            currentFormName: 'Form'
        },
        global: {
            provide: {
                entriesAddState: {
                    isSavingEntry: false,
                    questionParams: {currentInputRef: 'input-ref'}
                }
            },
            stubs: {
                ...ION_STUBS,
                QuestionLabelAction: false,
                ToolbarEntriesFilters: true,
                IconEntry: true
            }
        }
    });
    await flushPromises();
    await flushPromises();
    return wrapper;
}

describe('QuestionBranch PWA owner url restore', () => {
    let replaceStateSpy;

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        const rootStore = seedStore();
        routerMock.replace = vi.fn(() => Promise.resolve());
        routerMock.currentRoute = {value: {fullPath: OWNER_URL}};
        window.history.pushState({}, '', OWNER_URL);
        replaceStateSpy = vi.spyOn(window.history, 'replaceState');
        replaceStateSpy.mockClear();
        rootStore.isPWA = true;
    });

    it('keeps the address bar on the owner url after addBranch on the PWA', async () => {
        const rootStore = useRootStore();
        const wrapper = await factory();

        wrapper.vm.addBranch();
        await flushPromises();

        expect(branchEntryService.setUpNew).toHaveBeenCalled();
        expect(rootStore.routeParams.isBranch).toBe(true);
        expect(routerMock.replace).toHaveBeenCalledWith({name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD});
        expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, '', OWNER_URL);
    });

    it('keeps the address bar on the entry url after editBranchPWA on the PWA', async () => {
        const rootStore = useRootStore();
        const wrapper = await factory();
        seedBranchEntries(wrapper);

        await pwaVm(wrapper).editBranchPWA('branch-uuid-1');
        await flushPromises();

        expect(branchEntryService.setUpExisting).toHaveBeenCalledWith(expect.objectContaining({
            entryUuid: 'branch-uuid-1',
            ownerEntryUuid: 'owner-uuid',
            isBranch: true
        }));
        expect(rootStore.routeParams.branchEntryUuid).toBe('branch-uuid-1');
        expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, '', OWNER_URL);
    });

    it('does not touch the address bar when not on the PWA', async () => {
        const rootStore = useRootStore();
        rootStore.isPWA = false;
        const wrapper = await factory();

        wrapper.vm.addBranch();
        await flushPromises();

        expect(routerMock.replace).toHaveBeenCalled();
        expect(replaceStateSpy).not.toHaveBeenCalled();
    });
});
