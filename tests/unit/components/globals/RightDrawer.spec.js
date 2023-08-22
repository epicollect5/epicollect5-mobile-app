import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { menuController, modalController } from '@ionic/vue';
import { showModalLogin } from '@/use/show-modal-login';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';
import { logout } from '@/use/logout';
import RightDrawer from '@/components/globals/RightDrawer.vue';
import { mount, shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import flushPromises from 'flush-promises';
import { createTestingPinia } from '@pinia/testing';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { projectModel } from '@/models/project-model';
import { formModel } from '@/models/form-model.js';
import { useDBStore } from '@/stores/db-store';
import { databaseUpdateService } from '@/services/database/database-update-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { databaseSelectService } from '@/services/database/database-select-service';
import { databaseDeleteService } from '@/services/database/database-delete-service';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import ModalProjectInfo from '@/components/modals/ModalProjectInfo';
import ModalBookmarkAdd from '@/components/modals/ModalBookmarkAdd';

const projectRef = 'test-ref';

vi.mock('@/components/modals/ModalLogin', () => ({
    name: 'ModalLogin',
    template: '<div></div>'
}));

vi.mock('@/components/modals/ModalProjectInfo', () => ({
    default: {
        name: 'ModalProjectInfo',
        template: '<div></div>'
    }
}));

vi.mock('@/components/modals/ModalBookmarkAdd', () => ({
    default: {
        name: 'ModalBookmarkAdd',
        template: '<div></div>'
    }
}));

vi.mock('@/components/modals/ModalBookmarkAdd', () => ({
    default: {
        name: 'ModalBookmarkAdd',
        template: '<div></div>'
    }
}));

vi.mock('@/use/logout', () => ({
    logout: vi.fn()
}));

vi.mock('@/use/show-modal-login', () => ({
    showModalLogin: vi.fn()
}));

vi.mock('@/models/project-model', () => {
    const projectModel = vi.fn();
    projectModel.getExtraInputs = vi.fn();
    projectModel.getFormGroups = vi.fn();
    projectModel.destroy = vi.fn();
    projectModel.getProjectName = vi.fn();
    return { projectModel };
});

vi.mock('@/models/form-model', () => {
    const formModel = {
        formRef: 'mock-form-ref'
    };

    return { formModel };
});


vi.mock('@/services/database/database-update-service', () => {
    const databaseUpdateService = vi.fn();
    return { databaseUpdateService };
});
vi.mock('@/services/database/database-insert-service', () => {
    const databaseInsertService = vi.fn();
    return { databaseInsertService };
});

vi.mock('@/services/database/database-select-service', () => {
    const databaseSelectService = vi.fn();
    return { databaseSelectService };
});

vi.mock('@/services/database/database-delete-service', () => {
    const databaseDeleteService = vi.fn();
    return { databaseDeleteService };
});

const routerReplaceMock = vi.fn();
vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: routerReplaceMock,
        currentRoute: {
            value: { name: PARAMETERS.ROUTES.PROJECTS }
        }
        // You can add more router methods here if needed
    })
}));


beforeEach(() => {
    // tell vitest we use mocked time
    vi.useFakeTimers();
    setActivePinia(createPinia());
    vi.resetAllMocks();
});

describe('RightDrawer component', () => {

    it('should be in default language', async () => {
        const wrapper = shallowMount(RightDrawer, {
            global: {
                plugins: [createTestingPinia({
                    initialState: {
                        language: PARAMETERS.DEFAULT_LANGUAGE
                    }
                })]
            }
        });

        wrapper.findAll('[data-translate]').forEach((el) => {
            const key = el.attributes('data-translate');
            // console.log(`Testing translation for key: ${key}`);

            // Check if the key exists in the STRINGS object
            const expectedTranslation = STRINGS[PARAMETERS.DEFAULT_LANGUAGE]?.labels;

            // Assert that the key exists
            if (!expectedTranslation || !Object.prototype.hasOwnProperty.call(expectedTranslation, key)) {
                throw new Error(`'${PARAMETERS.DEFAULT_LANGUAGE}' Translation key '${key}' is missing.`);
            }

            // Get the actual translation from the component
            const actualTranslation = wrapper.get('[data-translate="' + key + '"]').text();

            // Use the translation key in the error message if the assertion fails
            expect(actualTranslation).toBe(expectedTranslation[key], `Translation for key '${key}' does not match.`);
        });
    });

    it('should be translated', async () => {

        PARAMETERS.SUPPORTED_LANGUAGES.forEach((language) => {
            const wrapper = shallowMount(RightDrawer, {
                global: {
                    plugins: [createTestingPinia({
                        fakeApp: true,
                        initialState: {
                            RootStore: {
                                language
                            }
                        }
                    })]
                }
            });

            const rootStore = useRootStore();
            expect(rootStore.language).toBe(language);

            wrapper.findAll('[data-translate]').forEach((el) => {
                const key = el.attributes('data-translate');
                //  console.log(`Testing translation for key: ${key}`);

                // Check if the key exists in the STRINGS object
                const expectedTranslation = STRINGS[rootStore.language]?.labels;

                // Assert that the key exists
                if (!expectedTranslation || !Object.prototype.hasOwnProperty.call(expectedTranslation, key)) {
                    throw new Error(`'${language}' Translation key '${key}' is missing.`);
                }

                // Get the actual translation from the component
                const actualTranslation = wrapper.get('[data-translate="' + key + '"]').text();

                // Use the translation key in the error message if the assertion fails
                expect(actualTranslation).toBe(expectedTranslation[key], `Translation for key '${key}' does not match.`);
            });
        });
    });

    it('should go to Upload page', async () => {

        // const rootStore = useRootStore(); //use fakeStore
        const wrapper = mount(RightDrawer);

        menuController.close = vi.fn().mockReturnValue(true);

        await flushPromises();
        await wrapper.get('[data-test="upload-page"]').trigger('click');
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
        });
        expect(menuController.close).toHaveBeenCalledOnce();
    });

    it('should go to Download page', async () => {

        // const fakeStore = createTestingPinia({
        //     fakeApp: true,
        //     initialState: {
        //         RootStore: {
        //             stubActions: false,
        //             createSpy: vi.fn,
        //             language: PARAMETERS.DEFAULT_LANGUAGE,
        //             user: { action: 'Logout', email: 'test@gmail.com' }
        //         }
        //     }
        // });

        // const rootStore = useRootStore(); //use fakeStore
        const wrapper = mount(RightDrawer);

        menuController.close = vi.fn().mockReturnValue(true);

        await flushPromises();
        await wrapper.get('[data-test="download-page"]').trigger('click');
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES_DOWNLOAD
        });
        expect(menuController.close).toHaveBeenCalledOnce();
    });

    it('should unsync entries', async () => {

        const rootStore = useRootStore();
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.unsyncAllEntries = vi.fn().mockResolvedValue(true);
        databaseUpdateService.unsyncAllBranchEntries = vi.fn().mockResolvedValue(true);
        databaseUpdateService.unsyncAllFileEntries = vi.fn().mockResolvedValue(true);

        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        // notificationService.showToast(labels.unsynced);
        notificationService.showToast = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="unsync-entries"]').trigger('click');
        await flushPromises();
        expect(projectModel.getProjectRef).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.wait);
        await flushPromises();
        expect(databaseUpdateService.unsyncAllEntries).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(databaseUpdateService.unsyncAllBranchEntries).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(databaseUpdateService.unsyncAllFileEntries).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(labels.unsynced);
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
                refreshEntries: true
            }
        });
        expect(menuController.close).toHaveBeenCalledOnce();
    });

    it('should sort AZ', async () => {

        const rootStore = useRootStore();
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="sort-by-az"]').trigger('click');
        await flushPromises();
        const orderBy = { field: 'title', sortType: 'ASC' };
        expect(databaseInsertService.insertSetting).toHaveBeenCalledWith(
            'order_by',
            JSON.stringify(orderBy)
        );
        await flushPromises();

        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
                refreshEntries: true,
                timestamp: Date.now()
            }
        });
    });

    it('should sort ZA', async () => {

        const rootStore = useRootStore();
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="sort-by-za"]').trigger('click');
        await flushPromises();
        const orderBy = { field: 'title', sortType: 'DESC' };
        expect(databaseInsertService.insertSetting).toHaveBeenCalledWith(
            'order_by',
            JSON.stringify(orderBy)
        );
        await flushPromises();

        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
                refreshEntries: true,
                timestamp: Date.now()
            }
        });
    });

    it('should sort by newest', async () => {

        const rootStore = useRootStore();
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="sort-by-newest"]').trigger('click');
        await flushPromises();
        const orderBy = { field: 'created_at', sortType: 'DESC' };
        expect(databaseInsertService.insertSetting).toHaveBeenCalledWith(
            'order_by',
            JSON.stringify(orderBy)
        );
        await flushPromises();

        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
                refreshEntries: true,
                timestamp: Date.now()
            }
        });
    });

    it('should sort by oldest', async () => {

        const rootStore = useRootStore();
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="sort-by-oldest"]').trigger('click');
        await flushPromises();
        const orderBy = { field: 'created_at', sortType: 'ASC' };
        expect(databaseInsertService.insertSetting).toHaveBeenCalledWith(
            'order_by',
            JSON.stringify(orderBy)
        );
        await flushPromises();

        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
                refreshEntries: true,
                timestamp: Date.now()
            }
        });
    });

    it('should delete project (no media files)', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_113: '---',
            ec5_114: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [],
            photos: [],
            videos: []
        });
        databaseDeleteService.deleteProject = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        await wrapper.get('[data-test="delete-project"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_113,
            labels.delete_project
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_project);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(databaseDeleteService.deleteProject).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.getBookmarks).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_114
        );

        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS,
            query: { refresh: true }
        });
    });

    it('should dismiss delete project modal if user dismiss', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_113: '---',
            ec5_114: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(false);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [],
            photos: [],
            videos: []
        });
        databaseDeleteService.deleteProject = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        await wrapper.get('[data-test="delete-project"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_113,
            labels.delete_project
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).not.toHaveBeenCalledWith(labels.deleting_project);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).not.toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(databaseDeleteService.deleteProject).not.toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).not.toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.getBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_114
        );

        expect(routerReplaceMock).not.toHaveBeenCalledOnce();
        expect(routerReplaceMock).not.toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS,
            query: { refresh: true }
        });
    });

    it('should delete project (with media files)', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_113: '---',
            ec5_114: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [{}],
            photos: [{}],
            videos: [{}]
        });
        deleteFileService.removeFiles = vi.fn();
        databaseDeleteService.deleteProject = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        await wrapper.get('[data-test="delete-project"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_113,
            labels.delete_project
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_project);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(deleteFileService.removeFiles).toHaveBeenCalled();
        await flushPromises();
        expect(databaseDeleteService.deleteProject).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.getBookmarks).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_114
        );

        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS,
            query: { refresh: true }
        });
    });

    it('should warn if delete project fails (no media files)', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_113: '---',
            ec5_114: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [],
            photos: [],
            videos: []
        });
        databaseDeleteService.deleteProject = vi.fn().mockImplementation(() => {
            throw new Error('Mocked error');
        });

        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        await wrapper.get('[data-test="delete-project"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_113,
            labels.delete_project
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_project);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(databaseDeleteService.deleteProject).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.unknown_error, labels.error);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(bookmarksService.getBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).not.toHaveBeenCalled();

    });

    it('should warn if delete project fails (with media files)', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_113: '---',
            ec5_114: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [{}],
            photos: [{}],
            videos: [{}]
        });
        deleteFileService.removeFiles = vi.fn();
        databaseDeleteService.deleteProject = vi.fn().mockImplementation(() => {
            throw new Error('Mocked error');
        });

        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        await wrapper.get('[data-test="delete-project"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_113,
            labels.delete_project
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_project);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(deleteFileService.removeFiles).toHaveBeenCalled();
        await flushPromises();
        expect(databaseDeleteService.deleteProject).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.unknown_error, labels.error);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(bookmarksService.getBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).not.toHaveBeenCalled();
    });

    it('should warn if delete media fails', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_113: '---',
            ec5_114: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [{}],
            photos: [{}],
            videos: [{}]
        });
        databaseDeleteService.deleteProject = vi.fn();
        deleteFileService.removeFiles = vi.fn().mockImplementation(() => {
            throw new Error('Mocked error');
        });

        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        await wrapper.get('[data-test="delete-project"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_113,
            labels.delete_project
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_project);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(deleteFileService.removeFiles).toHaveBeenCalled();
        await flushPromises();
        expect(databaseDeleteService.deleteProject).not.toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.unknown_error, labels.error);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(bookmarksService.getBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).not.toHaveBeenCalled();
    });

    it('should open ProjectInfo modal', async () => {
        const wrapper = mount(RightDrawer);
        const presentMock = vi.fn();
        modalController.create = vi.fn().mockResolvedValue({
            present: presentMock // Using the create mock function
        });

        await flushPromises();
        await wrapper.get('[data-test="project-info"]').trigger('click');
        expect(modalController.create).toHaveBeenCalledOnce();
        expect(modalController.create).toHaveBeenCalledWith({
            cssClass: 'modal-project-info',
            component: ModalProjectInfo,
            showBackdrop: true,
            backdropDismiss: false,
            componentProps: {}
        });
        expect(presentMock).toHaveBeenCalledOnce();
    });

    it('should dismiss delete entries modal if user dismiss', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_121: '---',
            ec5_122: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(false);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [],
            photos: [],
            videos: []
        });
        databaseDeleteService.deleteEntries = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();
        deleteFileService.removeFiles = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="delete-entries"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_121,
            labels.delete_all_entries
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).not.toHaveBeenCalledWith(labels.deleting_entries);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).not.toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(deleteFileService.removeFiles).not.toHaveBeenCalled();
        await flushPromises();
        expect(databaseDeleteService.deleteEntries).not.toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).not.toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.getBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_122
        );

        expect(routerReplaceMock).not.toHaveBeenCalledOnce();
        expect(routerReplaceMock).not.toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: { refreshEntries: true }
        });
    });

    it('should delete entries (no media files)', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_121: '---',
            ec5_122: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [],
            photos: [],
            videos: []
        });
        databaseDeleteService.deleteEntries = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();
        deleteFileService.removeFiles = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="delete-entries"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_121,
            labels.delete_all_entries
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_entries);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(deleteFileService.removeFiles).not.toHaveBeenCalled();
        await flushPromises();
        expect(databaseDeleteService.deleteEntries).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.getBookmarks).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_122
        );

        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: { refreshEntries: true }
        });
    });

    it('should delete entries (with media files)', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_121: '---',
            ec5_122: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [{}],
            photos: [{}],
            videos: [{}]
        });
        databaseDeleteService.deleteEntries = vi.fn().mockResolvedValue(true);
        deleteFileService.removeFiles = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        await wrapper.get('[data-test="delete-entries"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_121,
            labels.delete_all_entries
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_entries);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(deleteFileService.removeFiles).toHaveBeenCalled();
        await flushPromises();
        expect(databaseDeleteService.deleteEntries).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.getBookmarks).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_122
        );

        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: { refreshEntries: true }
        });
    });

    it('should warn delete entries failed (no media files)', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_121: '---',
            ec5_122: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [],
            photos: [],
            videos: []
        });
        databaseDeleteService.deleteEntries = vi.fn().mockImplementation(() => {
            throw new Error('Mocked error');
        });
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();
        deleteFileService.removeFiles = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="delete-entries"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_121,
            labels.delete_all_entries
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_entries);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(deleteFileService.removeFiles).not.toHaveBeenCalled();
        await flushPromises();
        expect(databaseDeleteService.deleteEntries).toHaveBeenCalledWith(projectRef);
        await flushPromises();
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.unknown_error, labels.error);
        expect(bookmarksService.deleteBookmarks).not.toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.getBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_122
        );

        expect(routerReplaceMock).not.toHaveBeenCalledOnce();
        expect(routerReplaceMock).not.toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: { refreshEntries: true }
        });
    });

    it('should delete entries failed (with media files)', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_121: '---',
            ec5_122: '---'
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        databaseInsertService.insertSetting = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.confirmSingle = vi.fn().mockResolvedValue(true);
        databaseSelectService.selectProjectMedia = vi.fn().mockResolvedValue({
            audios: [{}],
            photos: [{}],
            videos: [{}]
        });
        databaseDeleteService.deleteEntries = vi.fn().mockResolvedValue(true);
        deleteFileService.removeFiles = vi.fn().mockImplementation(() => {
            throw new Error('Mocked error');
        });
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        await wrapper.get('[data-test="delete-entries"]').trigger('click');
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_121,
            labels.delete_all_entries
        );
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.deleting_entries);
        await flushPromises();
        expect(databaseSelectService.selectProjectMedia).toHaveBeenCalledWith({
            project_ref: projectRef,
            synced: null,
            entry_uuid: null
        });
        await flushPromises();
        expect(deleteFileService.removeFiles).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.unknown_error, labels.error);
        await flushPromises();
        expect(databaseDeleteService.deleteEntries).not.toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.deleteBookmarks).not.toHaveBeenCalledWith(projectRef);
        await flushPromises();
        expect(bookmarksService.getBookmarks).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_122
        );
        expect(routerReplaceMock).not.toHaveBeenCalledOnce();
        expect(routerReplaceMock).not.toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: { refreshEntries: true }
        });
    });

    it('should open ModalBookmarkAdd', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_121: '---',
            ec5_122: '---'
        };
        const wrapper = mount(RightDrawer);
        const presentMock = vi.fn();
        const onDidDismissMock = vi.fn().mockResolvedValue(true);
        modalController.create = vi.fn().mockResolvedValue({
            present: presentMock,
            onDidDismiss: onDidDismissMock // Using the create mock function
        });
        const projectNameMock = 'Project name';
        const bookmarkTitle = projectNameMock;

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        projectModel.getProjectName = vi.fn().mockReturnValue(projectNameMock);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);

        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        expect(wrapper.find('[data-test="bookmark-remove"]').exists()).toBe(false);
        await wrapper.get('[data-test="bookmark-add"]').trigger('click');

        expect(modalController.create).toHaveBeenCalledOnce();
        expect(modalController.create).toHaveBeenCalledWith({
            cssClass: 'modal-bookmark-add',
            component: ModalBookmarkAdd,
            showBackdrop: true,
            backdropDismiss: false,
            componentProps: {
                bookmarkTitle,
                formRef: formModel.formRef,
                projectRef
            }
        });
        expect(presentMock).toHaveBeenCalledOnce();
    });

    it('should remove current page from bookmarks', async () => {

        const rootStore = useRootStore();
        const bookmarkStore = useBookmarkStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_127: '---',
            ec5_104: '---'
        };
        const bookmarkId = 1;
        bookmarkStore.bookmarkId = bookmarkId;//set current page as bookmarked
        const wrapper = mount(RightDrawer);

        const projectNameMock = 'Project name';

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        projectModel.getProjectName = vi.fn().mockReturnValue(projectNameMock);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);

        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.deleteBookmark = vi.fn().mockResolvedValue(true);
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        expect(wrapper.find('[data-test="bookmark-add"]').exists()).toBe(false);
        await wrapper.get('[data-test="bookmark-remove"]').trigger('click');
        await flushPromises();
        expect(bookmarksService.deleteBookmark).toHaveBeenCalledWith(bookmarkId);
        expect(notificationService.showToast).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_127);
        expect(menuController.close).toHaveBeenCalledOnce();
    });

    it('should catch bookmark remove error', async () => {

        const rootStore = useRootStore();
        const bookmarkStore = useBookmarkStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        const labels = STRINGS[rootStore.language].labels;
        STRINGS[language].status_codes = {
            ec5_127: '---',
            ec5_104: '---'
        };
        const bookmarkId = 1;
        bookmarkStore.bookmarkId = bookmarkId;//set current page as bookmarked
        const wrapper = mount(RightDrawer);

        const projectNameMock = 'Project name';

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        projectModel.getProjectName = vi.fn().mockReturnValue(projectNameMock);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);

        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.deleteBookmark = vi.fn().mockImplementation(() => {
            throw new Error('Mocked error');
        });
        bookmarksService.getBookmarks = vi.fn();

        await flushPromises();
        expect(wrapper.find('[data-test="bookmark-add"]').exists()).toBe(false);
        await wrapper.get('[data-test="bookmark-remove"]').trigger('click');
        await flushPromises();
        expect(bookmarksService.deleteBookmark).toHaveBeenCalledWith(bookmarkId);
        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_104);
        expect(notificationService.showToast).not.toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_127);
        expect(menuController.close).toHaveBeenCalledOnce();
    });
});