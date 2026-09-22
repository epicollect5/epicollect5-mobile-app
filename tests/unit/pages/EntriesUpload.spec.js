import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import flushPromises from 'flush-promises';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import EntriesUpload from '@/pages/EntriesUpload.vue';
import { uploadMediaService } from '@/services/upload-media-service';
import { uploadDataService } from '@/services/upload-data-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { mediaService } from '@/services/entry/media-service';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { projectModel } from '@/models/project-model.js';
import { modalController, useBackButton } from '@ionic/vue';
import { updateProject } from '@/use/project/update-project';

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: routerReplace,
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
        confirmSingle: vi.fn(),
        dismissModalSafe: vi.fn()
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
        vi.clearAllMocks();

        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;

        //uploads never settle unless a test overrides them
        uploadDataService.execute.mockReturnValue(new Promise(() => {}));
        uploadMediaService.execute.mockReturnValue(new Promise(() => {}));

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

    function mountPage() {
        return mount(EntriesUpload, {
            global: {
                components: {
                    'base-layout': {
                        name: 'BaseLayoutStub',
                        template: '<div><slot name="content" /></div>'
                    }
                }
            }
        });
    }

    //make the data upload reject with the given error, so _handleGeneralError runs
    function rejectUploadWith(error) {
        databaseSelectService.countUnsyncedEntries.mockResolvedValue({
            rows: {
                item: () => ({
                    total_number_of_entries: 1,
                    total_number_of_entries_unsynced: 1,
                    total_number_of_entries_with_errors: 0,
                    total_number_of_incomplete_entries: 0
                })
            }
        });
        uploadDataService.execute.mockImplementation(() => Promise.reject(error));
    }

    function getHardwareBackHandler() {
        return useBackButton.mock.calls[0][1];
    }

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

    it('blocks the hardware back button while a project update is in flight', async () => {
        const rootStore = useRootStore();
        const wrapper = mountPage();
        await flushPromises();

        rootStore.isProjectUpdating = true;
        const backHandler = getHardwareBackHandler();

        expect(backHandler()).toBe(false);
        await flushPromises();

        expect(routerReplace).not.toHaveBeenCalled();

        wrapper.unmount();
    });

    it('blocks the hardware back button while an upload is in flight', async () => {
        const wrapper = mountPage();
        await flushPromises();

        wrapper.vm.state.isUploading = true;
        getHardwareBackHandler()();
        await flushPromises();

        expect(routerReplace).not.toHaveBeenCalled();

        wrapper.unmount();
    });

    it('lets the hardware back button through when no upload or update is running', async () => {
        const wrapper = mountPage();
        await flushPromises();

        getHardwareBackHandler()();
        await flushPromises();

        expect(routerReplace).toHaveBeenCalledTimes(1);

        wrapper.unmount();
    });

    it('ignores the toolbar back button while a project update is in flight', async () => {
        const rootStore = useRootStore();
        const wrapper = mountPage();
        await flushPromises();

        rootStore.isProjectUpdating = true;
        wrapper.vm.goBack();
        await flushPromises();

        expect(routerReplace).not.toHaveBeenCalled();

        wrapper.unmount();
    });

    it('navigates back from the toolbar when no update is in flight', async () => {
        const wrapper = mountPage();
        await flushPromises();

        wrapper.vm.goBack();
        await flushPromises();

        expect(routerReplace).toHaveBeenCalledTimes(1);

        wrapper.unmount();
    });

    it('ignores the entries errors button while a project update is in flight', async () => {
        const rootStore = useRootStore();
        const wrapper = mountPage();
        await flushPromises();

        rootStore.isProjectUpdating = true;
        wrapper.vm.goToEntriesErrors();
        await flushPromises();

        expect(routerReplace).not.toHaveBeenCalled();

        wrapper.unmount();
    });

    it('opens the entries errors page when no update is in flight', async () => {
        const wrapper = mountPage();
        await flushPromises();

        wrapper.vm.goToEntriesErrors();
        await flushPromises();

        expect(routerReplace).toHaveBeenCalledWith(
            expect.objectContaining({ name: PARAMETERS.ROUTES.ENTRIES_ERRORS })
        );

        wrapper.unmount();
    });

    it('holds the navigation lock while the project outdated prompt is shown and releases it on cancel', async () => {
        const rootStore = useRootStore();
        const projectOutdatedError = {
            data: { errors: [{ code: PARAMETERS.PROJECT_OUTDATED_ERROR_CODES[0] }] }
        };
        rejectUploadWith(projectOutdatedError);

        let lockSeenDuringPrompt;
        notificationService.confirmSingle.mockImplementation(async () => {
            lockSeenDuringPrompt = rootStore.isProjectUpdating;
            return false;
        });

        const wrapper = mountPage();
        await flushPromises();

        await wrapper.vm.uploadData();
        await flushPromises();

        expect(notificationService.confirmSingle).toHaveBeenCalled();
        expect(lockSeenDuringPrompt).toBe(true);
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(updateProject).not.toHaveBeenCalled();
        expect(errorsService.handleWebError).toHaveBeenCalledWith(projectOutdatedError);

        wrapper.unmount();
    });

    it('keeps the navigation lock through a confirmed project update and releases it afterwards', async () => {
        const rootStore = useRootStore();
        const projectOutdatedError = {
            data: { errors: [{ code: PARAMETERS.PROJECT_OUTDATED_ERROR_CODES[0] }] }
        };
        rejectUploadWith(projectOutdatedError);
        updateProject.mockResolvedValue();

        let lockSeenDuringPrompt;
        notificationService.confirmSingle.mockImplementation(async () => {
            lockSeenDuringPrompt = rootStore.isProjectUpdating;
            return true;
        });

        const wrapper = mountPage();
        await flushPromises();

        await wrapper.vm.uploadData();
        await flushPromises();

        expect(lockSeenDuringPrompt).toBe(true);
        expect(updateProject).toHaveBeenCalledTimes(1);
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(errorsService.handleWebError).not.toHaveBeenCalled();

        wrapper.unmount();
    });

    it('releases the navigation lock after a failed project update without leaking the rejection', async () => {
        const rootStore = useRootStore();
        rejectUploadWith({
            data: { errors: [{ code: PARAMETERS.PROJECT_OUTDATED_ERROR_CODES[0] }] }
        });
        updateProject.mockRejectedValue(new Error('update failed'));

        notificationService.confirmSingle.mockResolvedValue(true);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const wrapper = mountPage();
        await flushPromises();

        await wrapper.vm.uploadData();
        await flushPromises();

        expect(updateProject).toHaveBeenCalledTimes(1);
        expect(rootStore.isProjectUpdating).toBe(false);
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
        wrapper.unmount();
    });
});