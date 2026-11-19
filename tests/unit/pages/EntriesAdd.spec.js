import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { h } from 'vue';
import flushPromises from 'flush-promises';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import EntriesAdd from '@/pages/EntriesAdd.vue';
import QuestionSaved from '@/components/questions/QuestionSaved.vue';
import { setupPWAEntry } from '@/use/entry/setup-pwa-entry';
import { handlePrev } from '@/use/questions/handle-prev';
import { projectModel } from '@/models/project-model.js';
import { formModel } from '@/models/form-model.js';

//the page imports every question component through its dispatchers: mocking
//the navigation pieces isolates the add-another flow from the jump machinery
vi.mock('vue-router', () => ({
    useRouter: () => ({
        push: vi.fn(),
        currentRoute: {value: {}}
    })
}));

vi.mock('@ionic/vue', () => ({
    useBackButton: vi.fn()
}));

vi.mock('@/models/project-model.js');

vi.mock('@/models/form-model.js');

vi.mock('@/use/entry/setup-pwa-entry', () => ({
    setupPWAEntry: vi.fn()
}));

//initialSetup re-seeds scope.entryService with the real singleton at mount,
//which would clobber the scope stub below
vi.mock('@/use/questions/initial-setup', () => ({
    initialSetup: vi.fn(),
    warmRegexEngine: vi.fn()
}));

vi.mock('@/use/questions/handle-prev', () => ({
    handlePrev: vi.fn()
}));

vi.mock('@/use/questions/handle-next', () => ({
    handleNext: vi.fn()
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(() => Promise.resolve()),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn(),
        showToast: vi.fn(),
        confirmMultiple: vi.fn()
    }
}));

describe('EntriesAdd - add another entry (PWA)', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        setupPWAEntry.mockResolvedValue('form-1');
        projectModel.getInputs.mockReturnValue(['first_ref']);
        formModel.getName.mockReturnValue('Form 1');
    });

    const mountPage = () => {
        const rootStore = useRootStore();
        rootStore.isPWA = true;
        rootStore.notFound = false;
        rootStore.language = 'en';
        rootStore.entriesAddScope = {
            entryService: {
                action: PARAMETERS.ENTRY_ADD,
                entry: {
                    isBranch: false,
                    entryUuid: 'previous-entry-uuid',
                    answers: {},
                    media: {}
                }
            }
        };

        return mount(EntriesAdd, {
            //base-layout is registered globally in main.js, not imported: in
            //tests it must resolve to a component that renders the default slot,
            //or the entire page content is skipped
            global: {
                components: {
                    //base-layout is registered globally in main.js, not
                    //imported: in tests it must resolve to a component that
                    //renders the named slots, or the entire page content is
                    //skipped (the questions live in the #content slot). A
                    //render function, because string templates need the runtime
                    //compiler this build does not ship
                    'base-layout': {
                        setup(_, {slots}) {
                            return () => h('div', [
                                slots['actions-start']?.(),
                                slots['actions-end']?.(),
                                slots.subheader?.(),
                                slots.content?.(),
                                slots.footer?.()
                            ]);
                        }
                    }
                }
            }
        });
    };

    const showSavedScreen = async (wrapper) => {
        wrapper.vm.state.showSaved = true;
        wrapper.vm.state.isFetching = false;
        wrapper.vm.state.entrySavedPWA = true;
        wrapper.vm.state.showSave = false;
        await wrapper.vm.$nextTick();
        await wrapper.vm.$nextTick();
    };

    it('resets the stale branch queue and per-question errors when adding another entry', async () => {
        const rootStore = useRootStore();
        //the previous entry queued local branches and left validation errors
        //behind: both live in session-wide state that the new entry shares
        rootStore.queueTempBranchEntriesPWA = {
            input_branch_1: [{id: 'stale-branch-uuid'}]
        };

        const wrapper = mountPage();
        wrapper.vm.state.error.errors['input_text_1'] = {message: 'stale error'};
        await showSavedScreen(wrapper);

        const saved = wrapper.findComponent(QuestionSaved);
        saved.vm.$emit('add-entry-pwa');
        await flushPromises();

        //a new entry is set up on the same form (same input refs)
        expect(setupPWAEntry).toHaveBeenCalledWith(PARAMETERS.PWA_ADD_ENTRY, false);

        //the queued branches were uploaded with the previous entry: the queue
        //must be dropped, or fetch-branch-entries replays them as the new
        //entry's branch list
        expect(rootStore.queueTempBranchEntriesPWA).toEqual({});

        //the per-question errors are read by reference: leftovers would
        //re-render on the new entry's questions
        expect(wrapper.vm.state.error.errors).toEqual({});

        //the flow restarts from the first question with a fake answer
        expect(handlePrev).toHaveBeenCalledTimes(1);
        expect(handlePrev.mock.calls[0][0]).toBe(wrapper.vm.state);
        expect(rootStore.entriesAddScope.entryService.entry.answers['first_ref']).toEqual({
            answer: '',
            was_jumped: false
        });
        expect(wrapper.vm.state.entrySavedPWA).toBe(false);
        expect(wrapper.vm.state.showSaved).toBe(false);
        expect(wrapper.vm.state.disablePrevious).toBe(true);
        wrapper.unmount();
    });
});
