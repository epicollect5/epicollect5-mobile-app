import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { menuController, modalController } from '@ionic/vue';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';
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
import { versioningService } from '@/services/utilities/versioning-service';
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

vi.mock('@/use/auth/logout', () => ({
    logout: vi.fn()
}));

vi.mock('@/use/auth/show-modal-login', () => ({
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

vi.mock('@/services/utilities/versioning-service', () => {
    const versioningService = vi.fn();
    return { versioningService };
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
        const wrapper = mount(RightDrawer, {
            global: {
                plugins: [createTestingPinia({
                    initialState: {
                        language: PARAMETERS.DEFAULT_LANGUAGE
                    }
                })]
            }
        });

        //Ionic projects slotted text asynchronously via requestAnimationFrame,
        //which is faked; advance timers so the slot renders before we read it.
        vi.advanceTimersByTime(16);
        await flushPromises();

        wrapper.findAll('[data-translate]').forEach((el) => {
            const key = el.attributes('data-translate');

            // Check if the key exists in the STRINGS object
            const expectedTranslation = STRINGS[PARAMETERS.DEFAULT_LANGUAGE]?.labels;

            // Assert that the key exists
            if (!expectedTranslation || !Object.prototype.hasOwnProperty.call(expectedTranslation, key)) {
                throw new Error(`'${PARAMETERS.DEFAULT_LANGUAGE}' Translation key '${key}' is missing.`);
            }

            // Assert the rendered HTML contains the expected translation
            expect(el.html()).toContain(expectedTranslation[key]);
        });
    });

    it('should be translated', async () => {

        for (const language of PARAMETERS.SUPPORTED_LANGUAGES) {
            const wrapper = mount(RightDrawer, {
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

            //Ionic projects slotted text asynchronously via requestAnimationFrame,
            //which is faked; advance timers so the slot renders before we read it.
            vi.advanceTimersByTime(16);
            await flushPromises();

            wrapper.findAll('[data-translate]').forEach((el) => {
                const key = el.attributes('data-translate');

                // Check if the key exists in the STRINGS object
                const expectedTranslation = STRINGS[rootStore.language]?.labels;

                // Assert that the key exists
                if (!expectedTranslation || !Object.prototype.hasOwnProperty.call(expectedTranslation, key)) {
                    throw new Error(`'${language}' Translation key '${key}' is missing.`);
                }

                // Assert the rendered HTML contains the expected translation
                expect(el.html()).toContain(expectedTranslation[key]);
            });
        }
    });

    it('should go to Upload page', async () => {

        const rootStore = useRootStore();
        rootStore.device = {
            platform: PARAMETERS.WEB
        };

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

        const rootStore = useRootStore();
        rootStore.device = {
            platform: PARAMETERS.WEB
        };

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
        rootStore.device = {
            platform: PARAMETERS.WEB
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        versioningService.removeStaleEntries = vi.fn().mockResolvedValue(true);
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
        expect(versioningService.removeStaleEntries).toHaveBeenCalledOnce();
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
            query: expect.objectContaining({
                refreshEntries: true,
                timestamp: expect.any(Number)
            })
        });
        expect(menuController.close).toHaveBeenCalledOnce();
    });

    it('should abort unsync if the stale cleanup fails', async () => {

        const rootStore = useRootStore();
        const dbStore = useDBStore();
        rootStore.device = {
            platform: PARAMETERS.WEB
        };
        const wrapper = mount(RightDrawer);

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);
        const cleanupError = new Error('cleanup error');
        cleanupError.isStaleCleanupError = true;
        versioningService.removeStaleEntries = vi.fn().mockRejectedValue(cleanupError);
        databaseUpdateService.unsyncAllEntries = vi.fn().mockResolvedValue(true);
        databaseUpdateService.unsyncAllBranchEntries = vi.fn().mockResolvedValue(true);
        databaseUpdateService.unsyncAllFileEntries = vi.fn().mockResolvedValue(true);

        await flushPromises();
        await wrapper.get('[data-test="unsync-entries"]').trigger('click');
        await flushPromises();
        expect(versioningService.removeStaleEntries).toHaveBeenCalledOnce();
        //the unsync must be aborted, otherwise stale entries would be marked as unsynced
        expect(databaseUpdateService.unsyncAllEntries).not.toHaveBeenCalled();
        expect(databaseUpdateService.unsyncAllBranchEntries).not.toHaveBeenCalled();
        expect(databaseUpdateService.unsyncAllFileEntries).not.toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[rootStore.language].labels.stale_cleanup_failed, STRINGS[rootStore.language].labels.error);
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(routerReplaceMock).not.toHaveBeenCalled();
    });

    it('should sort AZ', async () => {

        const rootStore = useRootStore();
        const dbStore = useDBStore();
        const wrapper = mount(RightDrawer);
        rootStore.device = {
            platform: PARAMETERS.WEB
        };

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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);
        databaseDeleteService.deleteProject = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn().mockResolvedValue([]);

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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, true);
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);
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
        expect(deleteFileService.removeProjectMediaDirectories).not.toHaveBeenCalled();
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);
        databaseDeleteService.deleteProject = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn().mockResolvedValue([]);

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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, true);
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);
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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, true);
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);
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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, true);
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        databaseDeleteService.deleteProject = vi.fn();
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockImplementation(() => {
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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, true);
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
        const rootStore = useRootStore();
        rootStore.device = {
            platform: PARAMETERS.WEB
        };
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        databaseDeleteService.deleteEntries = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);

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
        expect(deleteFileService.removeProjectMediaDirectories).not.toHaveBeenCalled();
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
            query: expect.objectContaining({
                refreshEntries: true,
                timestamp: expect.any(Number)
            })
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        databaseDeleteService.deleteEntries = vi.fn().mockResolvedValue(true);
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);

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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, false);
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
            query: expect.objectContaining({
                refreshEntries: true,
                timestamp: expect.any(Number)
            })
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        databaseDeleteService.deleteEntries = vi.fn().mockResolvedValue(true);
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);
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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, false);
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
            query: expect.objectContaining({
                refreshEntries: true,
                timestamp: expect.any(Number)
            })
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        databaseDeleteService.deleteEntries = vi.fn().mockImplementation(() => {
            throw new Error('Mocked error');
        });
        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockResolvedValue(true);

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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, false);
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
            query: expect.objectContaining({
                refreshEntries: true,
                timestamp: expect.any(Number)
            })
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        databaseDeleteService.deleteEntries = vi.fn().mockResolvedValue(true);
        deleteFileService.removeProjectMediaDirectories = vi.fn().mockImplementation(() => {
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
        expect(deleteFileService.removeProjectMediaDirectories).toHaveBeenCalledWith(projectRef, false);
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
            query: expect.objectContaining({
                refreshEntries: true,
                timestamp: expect.any(Number)
            })
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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

    it('should change bookmark title with navigation', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const dbStore = useDBStore();
        STRINGS[language].status_codes = {
            ec5_121: '---',
            ec5_122: '---'
        };
        rootStore.device = {
            platform: PARAMETERS.WEB
        };
        const wrapper = mount(RightDrawer);
        const presentMock = vi.fn();
        const onDidDismissMock = vi.fn().mockResolvedValue(true);
        modalController.create = vi.fn().mockResolvedValue({
            present: presentMock,
            onDidDismiss: onDidDismissMock // Using the create mock function
        });
        const projectNameMock = 'Project name';
        const formNameMock = 'Form Name';

        //mocks
        menuController.close = vi.fn().mockReturnValue(true);
        projectModel.getProjectRef = vi.fn().mockReturnValue(projectRef);
        projectModel.getProjectName = vi.fn().mockReturnValue(projectNameMock);
        formModel.getName = vi.fn().mockReturnValue(formNameMock);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        dbStore.db.transaction = vi.fn();
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        utilsService.trunc = vi.fn().mockReturnValue('Bookmark Title');

        bookmarksService.deleteBookmarks = vi.fn();
        bookmarksService.getBookmarks = vi.fn();
        rootStore.hierarchyNavigation = [];
        await flushPromises();
        expect(wrapper.find('[data-test="bookmark-remove"]').exists()).toBe(false);
        await wrapper.get('[data-test="bookmark-add"]').trigger('click');

        expect(projectModel.getProjectName).toHaveBeenCalledOnce();
        expect(formModel.getName).not.toHaveBeenCalled();
        expect(utilsService.trunc).toHaveBeenCalledWith(projectNameMock, 50, false);

        rootStore.hierarchyNavigation = [{ parentEntryName: 'Parent' }];
        await flushPromises();
        await wrapper.get('[data-test="bookmark-add"]').trigger('click');
        expect(projectModel.getProjectName).toHaveBeenCalledOnce();
        expect(formModel.getName).toHaveBeenCalledOnce();
        expect(utilsService.trunc).toHaveBeenCalledWith(
            'Parent' + ' - ' + formNameMock,
            50, false
        );
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
        rootStore.device = {
            platform: PARAMETERS.WEB
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
