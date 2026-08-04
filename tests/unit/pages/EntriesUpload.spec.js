import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import flushPromises from 'flush-promises';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import EntriesUpload from '@/pages/EntriesUpload.vue';
import { uploadMediaService } from '@/services/upload-media-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { mediaService } from '@/services/entry/media-service';
import { utilsService } from '@/services/utilities/utils-service';
import { projectModel } from '@/models/project-model.js';
import { modalController } from '@ionic/vue';

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: vi.fn(),
        currentRoute: { value: {} }
    })
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    },
    useBackButton: vi.fn()
}));

vi.mock('@/use/auth/logout', () => ({
    logout: vi.fn().mockResolvedValue(true)
}));

vi.mock('@/use/auth/show-modal-login', () => ({
    showModalLogin: vi.fn()
}));

vi.mock('@/use/project/update-project', () => ({
    updateProject: vi.fn()
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        countUnsyncedEntries: vi.fn(),
        selectOneEntry: vi.fn(),
        selectOneBranchEntry: vi.fn(),
        countUnsyncedBranchEntries: vi.fn()
    }
}));

vi.mock('@/services/entry/media-service', () => ({
    mediaService: { getProjectStoredMedia: vi.fn() }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showAlert: vi.fn(),
        showToast: vi.fn(),
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        confirmSingle: vi.fn()
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: { handleWebError: vi.fn() }
}));

vi.mock('@/services/upload-data-service', () => ({
    uploadDataService: { execute: vi.fn().mockReturnValue(new Promise(() => {})) }
}));

vi.mock('@/services/upload-media-service', () => ({
    uploadMediaService: { execute: vi.fn().mockReturnValue(new Promise(() => {})) }
}));

vi.mock('@/components/modals/ModalProgressTransfer', () => ({
    default: {
        name: 'ModalProgressTransfer',
        template: '<div></div>'
    }
}));

describe('EntriesUpload page', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;

        vi.spyOn(utilsService, 'hasInternetConnection').mockResolvedValue(true);
        vi.spyOn(utilsService, 'getProjectNameMarkup').mockReturnValue('fake project');
        vi.spyOn(projectModel, 'getProjectRef').mockReturnValue('fake-project-ref');

        databaseSelectService.countUnsyncedEntries.mockResolvedValue({
            rows: {
                item: () => ({
                    total_number_of_entries: 0,
                    total_number_of_entries_unsynced: 0,
                    total_number_of_entries_with_errors: 0,
                    total_number_of_incomplete_entries: 0
                })
            }
        });

        mediaService.getProjectStoredMedia.mockResolvedValue({
            photos: [{
                file_type: PARAMETERS.QUESTION_TYPES.PHOTO,
                file_name: 'photo.jpg',
                project_ref: 'fake-project-ref',
                id: 'fake-photo-id'
            }],
            videos: [],
            audios: []
        });

        modalController.create.mockResolvedValue({
            present: vi.fn().mockResolvedValue()
        });
        modalController.dismiss.mockResolvedValue();
    });

    it('calls uploadMediaService.execute only once when the photos button is tapped twice rapidly', async () => {
        const wrapper = mount(EntriesUpload, {
            global: {
                components: {
                    'base-layout': {
                        name: 'BaseLayoutStub',
                        template: '<div><slot name="content" /></div>'
                    }
                }
            }
        });

        //let the mount-time _checkData/_checkMedia run so photos get populated
        await flushPromises();

        const labels = STRINGS[PARAMETERS.DEFAULT_LANGUAGE].labels;
        const photosButton = wrapper.findAll('ion-button').find((button) => button.text().includes(labels.upload_photos));

        expect(photosButton).toBeTruthy();
        expect(photosButton.attributes('disabled')).toBe('false');

        //simulate a double tap on the upload photos button
        await photosButton.trigger('click');
        await photosButton.trigger('click');
        await flushPromises();

        expect(uploadMediaService.execute).toHaveBeenCalledTimes(1);

        wrapper.unmount();
    });
});