import {mount} from '@vue/test-utils';
import {describe, it, expect, beforeEach, vi} from 'vitest';
import flushPromises from 'flush-promises';
import {setActivePinia, createPinia} from 'pinia';
import PopoverQuestionMedia from '@/components/popovers/PopoverQuestionMedia.vue';
import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';
import {popoverController} from '@ionic/vue';
import {notificationService} from '@/services/notification-service';
import {deleteFileService} from '@/services/filesystem/delete-file-service';
import {projectModel} from '@/models/project-model';

vi.mock('@ionic/vue', () => ({
    popoverController: {
        dismiss: vi.fn(),
        create: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        confirmSingle: vi.fn(),
        showAlert: vi.fn(),
        showToast: vi.fn()
    }
}));

vi.mock('@/services/filesystem/delete-file-service', () => ({
    deleteFileService: {
        removeFile: vi.fn(),
        removeFiles: vi.fn()
    }
}));

vi.mock('@/models/project-model', () => ({
    projectModel: {
        getSlug: vi.fn(() => 'test-slug'),
        getProjectRef: vi.fn(() => 'proj1')
    }
}));

vi.mock('@/services/web-service', () => ({
    webService: {
        deleteTempMediaFile: vi.fn()
    }
}));

vi.mock('@capacitor/share', () => ({
    Share: {
        share: vi.fn()
    }
}));

const ION_STUBS = {
    'ion-content': true,
    'ion-list': true,
    'ion-item': true,
    'ion-icon': true,
    'ion-label': true
};

const factory = (media) => {
    return mount(PopoverQuestionMedia, {
        props: {
            entryUuid: 'entry1',
            projectRef: 'proj1',
            inputRef: 'q1',
            media,
            mediaFolder: 'photos/',
            mediaType: PARAMETERS.QUESTION_TYPES.PHOTO
        },
        global: {
            stubs: ION_STUBS
        }
    });
};

function mountPopover(mediaType) {
    return mount(PopoverQuestionMedia, {
        props: {
            entryUuid: 'entry-uuid-1',
            projectRef: 'proj-ref',
            inputRef: 'test_ref',
            media: {'entry-uuid-1': {'test_ref': {cached: 'file.jpg', stored: ''}}},
            mediaFolder: PARAMETERS.PHOTO_DIR,
            mediaType
        },
        global: {
            stubs: ION_STUBS
        }
    });
}

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    const rootStore = useRootStore();
    rootStore.language = 'en';
    rootStore.device = {platform: 'android'};
    rootStore.tempDir = '/tmp/';
    rootStore.persistentDir = '/data/';
    rootStore.isPWA = false;
    rootStore.queueFilesToDelete = [];
    notificationService.confirmSingle.mockResolvedValue(true);
});

describe('PopoverQuestionMedia removeNative', () => {

    it('queues the stored file when deleting a retaken photo (cached + stored set)', async () => {
        deleteFileService.removeFile.mockResolvedValue();
        const wrapper = factory({
            entry1: {q1: {cached: 'entry1_1000.jpg', stored: 'entry1_1000.jpg', type: 'photo'}}
        });

        await wrapper.vm.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        //immediate temp delete still happens
        expect(deleteFileService.removeFile).toHaveBeenCalledWith('/tmp/entry1_1000.jpg');
        //persistent file + DB row queued for save-time deletion
        expect(useRootStore().queueFilesToDelete).toEqual([{
            inputRef: 'q1',
            entryUuid: 'entry1',
            filenameStored: 'entry1_1000.jpg',
            file_path: '/data/photos/',
            project_ref: 'proj1',
            file_name: 'entry1_1000.jpg'
        }]);
        expect(popoverController.dismiss).toHaveBeenCalledWith(PARAMETERS.ACTIONS.FILE_DELETED);
    });

    it('does not queue anything when only a cached file exists', async () => {
        deleteFileService.removeFile.mockResolvedValue();
        const wrapper = factory({
            entry1: {q1: {cached: 'fresh.jpg', stored: '', type: 'photo'}}
        });

        await wrapper.vm.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(deleteFileService.removeFile).toHaveBeenCalledWith('/tmp/fresh.jpg');
        expect(useRootStore().queueFilesToDelete).toEqual([]);
        expect(popoverController.dismiss).toHaveBeenCalledWith(PARAMETERS.ACTIONS.FILE_DELETED);
    });

    it('does not queue the stored file when the temp delete fails', async () => {
        deleteFileService.removeFile.mockRejectedValue({code: 5});
        const wrapper = factory({
            entry1: {q1: {cached: 'entry1_1000.jpg', stored: 'entry1_1000.jpg', type: 'photo'}}
        });

        await wrapper.vm.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        //failed delete keeps the original fully intact: nothing queued
        expect(useRootStore().queueFilesToDelete).toEqual([]);
        expect(popoverController.dismiss).toHaveBeenCalledWith();
        expect(notificationService.showAlert).toHaveBeenCalled();
    });

    it('keeps the existing stored-only queued path unchanged', async () => {
        const wrapper = factory({
            entry1: {q1: {cached: '', stored: 'stored.jpg', type: 'photo'}}
        });

        await wrapper.vm.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(deleteFileService.removeFile).not.toHaveBeenCalled();
        expect(useRootStore().queueFilesToDelete).toEqual([{
            inputRef: 'q1',
            entryUuid: 'entry1',
            filenameStored: 'stored.jpg',
            file_path: '/data/photos/',
            project_ref: 'proj1',
            file_name: 'stored.jpg'
        }]);
        expect(popoverController.dismiss).toHaveBeenCalledWith(PARAMETERS.ACTIONS.FILE_QUEUED);
    });
});

describe('PopoverQuestionMedia component', () => {

    it('shows the Draw entry on top of share and delete for photos', async () => {
        const wrapper = mountPopover(PARAMETERS.QUESTION_TYPES.PHOTO);
        await flushPromises();

        const items = wrapper.findAll('ion-item');
        expect(items).toHaveLength(3);
        //Draw is the first row, above share and delete
        expect(items[0].text().trim()).toBe('Draw Beta');
        expect(items[1].text().trim()).toBe('Share');
        expect(items[2].text().trim()).toBe('Delete');
    });

    it('hides the Draw entry for non-photo media', async () => {
        const wrapper = mountPopover(PARAMETERS.QUESTION_TYPES.VIDEO);
        await flushPromises();

        const items = wrapper.findAll('ion-item');
        expect(items).toHaveLength(2);
        expect(items.map((item) => item.text().trim())).not.toContain('Draw');
    });

    it('dismisses with the DRAW action when the Draw entry is tapped', async () => {
        const wrapper = mountPopover(PARAMETERS.QUESTION_TYPES.PHOTO);
        await flushPromises();

        wrapper.findAll('ion-item')[0].trigger('click');
        await flushPromises();

        //the caller (QuestionPhoto) reacts to the DRAW action and opens the pad
        expect(popoverController.dismiss).toHaveBeenCalledWith(PARAMETERS.ACTIONS.DRAW);
    });
});
