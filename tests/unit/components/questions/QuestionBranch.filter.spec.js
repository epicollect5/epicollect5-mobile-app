import { mount, shallowMount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import QuestionBranch from '@/components/questions/QuestionBranch.vue';
import { branchEntriesFilterService } from '@/services/entry/branch-entries-filter-service';
import { fetchBranchEntries } from '@/use/entries/fetch-branch-entries';
import { PARAMETERS } from '@/config';

vi.mock('@/services/entry/question-common-service', () => ({
    questionCommonService: {
        setUpInputParams: vi.fn()
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

vi.mock('vue-router', () => ({
    useRouter: () => ({ replace: vi.fn() }),
    useRoute: () => ({ params: {} })
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn(() => Promise.resolve())
    }
}));

const ION_STUBS = {
    'ion-item': { template: '<div><slot /></div>' },
    'ion-label': { template: '<div><slot /></div>' },
    'ion-button': { template: '<div><slot /></div>' },
    'ion-icon': true,
    'ion-item-divider': { template: '<div><slot /></div>' },
    'ion-card': { template: '<div><slot /></div>' },
    'ion-card-header': { template: '<div><slot /></div>' },
    'ion-card-title': { template: '<div><slot /></div>' },
    'ion-card-content': { template: '<div><slot /></div>' },
    'ion-grid': { template: '<div><slot /></div>' },
    'ion-row': { template: '<div><slot /></div>' },
    'ion-col': { template: '<div><slot /></div>' },
    'ion-list': { template: '<div><slot /></div>' },
    'ion-infinite-scroll': { template: '<div><slot /></div>' },
    'ion-infinite-scroll-content': true,
    'ion-spinner': true
};

function seedStore() {
    const rootStore = useRootStore();
    rootStore.language = 'en';
    rootStore.device = { platform: PARAMETERS.ANDROID };
    rootStore.isPWA = false;
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

async function factory() {
    branchEntriesFilterService.getBranchFilterCounts.mockResolvedValue({
        countNoFilters: 2,
        countWithFilters: 2,
        filters: { ...PARAMETERS.FILTERS_DEFAULT }
    });
    fetchBranchEntries.mockResolvedValue({ branchEntries: [], hasUnsavedBranches: false });
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
                    questionParams: { currentInputRef: 'input-ref' }
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

describe('QuestionBranch branch filter guard', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        seedStore();
    });

    it('does not open the filter modal while entries are fetching', async () => {
        const wrapper = await factory();
        wrapper.vm.state.isFetching = true;
        await wrapper.vm.openModalEntriesBranchFilter();
        expect(modalController.create).not.toHaveBeenCalled();
    });

    it('does not open the filter modal when there are no branches', async () => {
        const wrapper = await factory();
        wrapper.vm.state.countNoFilters = 0;
        await wrapper.vm.openModalEntriesBranchFilter();
        expect(modalController.create).not.toHaveBeenCalled();
    });

    it('opens the filter modal once fetching completes', async () => {
        modalController.create.mockResolvedValue({
            present: vi.fn(() => Promise.resolve()),
            onWillDismiss: vi.fn(() => new Promise(() => {}))
        });
        const wrapper = await factory();
        expect(wrapper.vm.state.isFetching).toBe(false);
        await wrapper.vm.openModalEntriesBranchFilter();
        expect(modalController.create).toHaveBeenCalledTimes(1);
        expect(modalController.create.mock.calls[0][0].componentProps.filters).toBeDefined();
    });

    it('disables the filter action while entries are fetching', async () => {
        branchEntriesFilterService.getBranchFilterCounts.mockResolvedValue({
            countNoFilters: 2,
            countWithFilters: 2,
            filters: { ...PARAMETERS.FILTERS_DEFAULT }
        });
        fetchBranchEntries.mockResolvedValue({ branchEntries: [], hasUnsavedBranches: false });
        const wrapper = shallowMount(QuestionBranch, {
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
                        questionParams: { currentInputRef: 'input-ref' }
                    }
                }
            }
        });
        await flushPromises();
        await flushPromises();
        const action = wrapper.find('question-label-action');
        expect(action.exists()).toBe(true);
        //shallowMount keeps the original tag: read the bound props off
        //the vnode to verify the template wiring
        expect(action.element.__vnode.props.disabled).toBe(false);
        wrapper.vm.state.isFetching = true;
        await wrapper.vm.$nextTick();
        expect(wrapper.find('question-label-action').element.__vnode.props.disabled).toBe(true);
        wrapper.vm.state.isFetching = false;
        wrapper.vm.state.countNoFilters = 0;
        await wrapper.vm.$nextTick();
        expect(wrapper.find('question-label-action').element.__vnode.props.disabled).toBe(true);
    });
});
