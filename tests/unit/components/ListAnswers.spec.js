import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import ListAnswers from '@/components/ListAnswers.vue';
import { useRootStore } from '@/stores/root-store';
import { branchEntryService } from '@/services/entry/branch-entry-service';

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn()
    }
}));

vi.mock('@/services/entry/entry-service', () => ({
    entryService: {
        setUpExisting: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/services/entry/branch-entry-service', () => ({
    branchEntryService: {
        setUpExisting: vi.fn().mockResolvedValue()
    }
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: vi.fn()
    })
}));

const factory = () => {
    return mount(ListAnswers, {
        props: {
            items: {},
            entry: { formRef: 'form1' },
            errors: {},
            formRef: 'form1',
            areGroupAnswers: false,
            areBranchAnswers: false
        },
        global: {
            stubs: {
                'ion-list': true,
                'ion-item': true,
                'ion-label': true,
                'ion-icon': true,
                'ion-button': true,
                'ion-infinite-scroll': true,
                'ion-infinite-scroll-content': true
            }
        }
    });
};

describe('ListAnswers edit paths', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        useRootStore().language = 'en';
    });

    it('resets a stale file delete queue when opening a branch entry for edit', async () => {
        useRootStore().queueFilesToDelete = [{
            inputRef: 'q1',
            filenameStored: 'other-entry-photo.jpg',
            file_path: '/data/photos/',
            project_ref: 'proj1',
            file_name: 'other-entry-photo.jpg'
        }];
        const wrapper = factory();

        await wrapper.vm.editAnswerBranch('ref1', 0);

        expect(branchEntryService.setUpExisting).toHaveBeenCalled();
        expect(useRootStore().queueFilesToDelete).toEqual([]);
    });
});
