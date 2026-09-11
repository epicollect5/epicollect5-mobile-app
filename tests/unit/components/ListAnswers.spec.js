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

    it('preserves the live file delete queue when opening a branch entry for edit', async () => {
        //hierarchy deletions queued mid-session (drill-down) plus this branch's
        //own deferred deletions (re-edit): the queue belongs to the live edit
        //session and must survive the branch open
        const queued = [
            {
                inputRef: 'hq1',
                filenameStored: 'hierarchy-photo.jpg',
                file_path: '/data/photos/',
                project_ref: 'proj1',
                file_name: 'hierarchy-photo.jpg'
            },
            {
                inputRef: 'bq1',
                filenameStored: 'branch-photo.jpg',
                file_path: '/data/photos/',
                project_ref: 'proj1',
                file_name: 'branch-photo.jpg'
            }
        ];
        useRootStore().queueFilesToDelete = [...queued];
        const wrapper = factory();

        await wrapper.vm.editAnswerBranch('ref1', 0);

        expect(branchEntryService.setUpExisting).toHaveBeenCalled();
        expect(useRootStore().queueFilesToDelete).toEqual(queued);
    });

    it('leaves an empty file delete queue alone when opening a branch entry for edit', async () => {
        useRootStore().queueFilesToDelete = [];
        const wrapper = factory();

        await wrapper.vm.editAnswerBranch('ref1', 0);

        expect(branchEntryService.setUpExisting).toHaveBeenCalled();
        expect(useRootStore().queueFilesToDelete).toEqual([]);
    });
});
