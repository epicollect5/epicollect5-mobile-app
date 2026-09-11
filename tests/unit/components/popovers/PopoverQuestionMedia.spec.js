import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import PopoverQuestionMedia from '@/components/popovers/PopoverQuestionMedia.vue';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { popoverController } from '@ionic/vue';
import { notificationService } from '@/services/notification-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { projectModel } from '@/models/project-model';

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
            stubs: {
                'ion-content': true,
                'ion-list': true,
                'ion-item': true,
                'ion-icon': true,
                'ion-label': true
            }
        }
    });
};

describe('PopoverQuestionMedia removeNative', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.device = { platform: 'android' };
        rootStore.tempDir = '/tmp/';
        rootStore.persistentDir = '/data/';
        rootStore.isPWA = false;
        rootStore.queueFilesToDelete = [];
        notificationService.confirmSingle.mockResolvedValue(true);
    });

    it('queues the stored file when deleting a retaken photo (cached + stored set)', async () => {
        deleteFileService.removeFile.mockResolvedValue();
        const wrapper = factory({
            entry1: { q1: { cached: 'entry1_1000.jpg', stored: 'entry1_1000.jpg', type: 'photo' } }
        });

        await wrapper.vm.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        //immediate temp delete still happens
        expect(deleteFileService.removeFile).toHaveBeenCalledWith('/tmp/entry1_1000.jpg');
        //persistent file + DB row queued for save-time deletion
        expect(useRootStore().queueFilesToDelete).toEqual([{
            inputRef: 'q1',
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
            entry1: { q1: { cached: 'fresh.jpg', stored: '', type: 'photo' } }
        });

        await wrapper.vm.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(deleteFileService.removeFile).toHaveBeenCalledWith('/tmp/fresh.jpg');
        expect(useRootStore().queueFilesToDelete).toEqual([]);
        expect(popoverController.dismiss).toHaveBeenCalledWith(PARAMETERS.ACTIONS.FILE_DELETED);
    });

    it('does not queue the stored file when the temp delete fails', async () => {
        deleteFileService.removeFile.mockRejectedValue({ code: 5 });
        const wrapper = factory({
            entry1: { q1: { cached: 'entry1_1000.jpg', stored: 'entry1_1000.jpg', type: 'photo' } }
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
            entry1: { q1: { cached: '', stored: 'stored.jpg', type: 'photo' } }
        });

        await wrapper.vm.remove();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(deleteFileService.removeFile).not.toHaveBeenCalled();
        expect(useRootStore().queueFilesToDelete).toEqual([{
            inputRef: 'q1',
            filenameStored: 'stored.jpg',
            file_path: '/data/photos/',
            project_ref: 'proj1',
            file_name: 'stored.jpg'
        }]);
        expect(popoverController.dismiss).toHaveBeenCalledWith(PARAMETERS.ACTIONS.FILE_QUEUED);
    });
});
