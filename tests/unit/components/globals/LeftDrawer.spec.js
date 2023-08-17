import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { menuController } from '@ionic/vue';
import { showModalLogin } from '@/use/show-modal-login';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';
import { logout } from '@/use/logout';
import LeftDrawer from '@/components/globals/LeftDrawer.vue';
import { mount, shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import flushPromises from 'flush-promises';
import { createTestingPinia } from '@pinia/testing';
import { webService } from '@/services/web-service';

vi.mock('@/components/modals/ModalLogin', () => ({
    name: 'ModalLogin',
    template: '<div></div>'
}));

vi.mock('@/use/logout', () => ({
    logout: vi.fn()
}));

vi.mock('@/use/show-modal-login', () => ({
    showModalLogin: vi.fn()
}));

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
    // const pinia = createPinia().use(createTestingPinia);
    // app.use(pinia);
    setActivePinia(createPinia());
    vi.resetAllMocks();
});

describe('LeftDrawer component', () => {

    it('should be in default language', async () => {
        const wrapper = shallowMount(LeftDrawer, {
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
            console.log(`Testing translation for key: ${key}`);

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
            const wrapper = shallowMount(LeftDrawer, {
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
                console.log(`Testing translation for key: ${key}`);

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

    it('should handle logout action', async () => {

        const fakeStore = createTestingPinia({
            fakeApp: true,
            initialState: {
                RootStore: {
                    stubActions: false,
                    createSpy: vi.fn,
                    language: PARAMETERS.DEFAULT_LANGUAGE,
                    user: { action: 'Logout' }
                }
            }
        });

        const wrapper = mount(LeftDrawer, { attachTo: document.body });

        const rootStore = useRootStore(); // uses the fakeStore pinia!
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        expect(rootStore.language).toBe(PARAMETERS.DEFAULT_LANGUAGE);

        rootStore.user.action = STRINGS[language].labels.logout;
        expect(rootStore.user.action).toBe(STRINGS[language].labels.logout);
        STRINGS[language].status_codes = {
            ec5_141: 'ec5_141'
        };
        logout.mockResolvedValue(true);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        notificationService.showToast = vi.fn().mockReturnValue(true);
        menuController.close = vi.fn().mockReturnValue(true);

        await wrapper.find('[data-test="performAuthAction"]').trigger('click');
        expect(logout).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_141);
        await flushPromises();
        expect(menuController.close).toHaveBeenCalledOnce();

        rootStore.user.action = labels.login;
        expect(rootStore.user.action).toBe(labels.login);

        await flushPromises();
        await wrapper.vm.$nextTick();
        const text = wrapper.find('[data-test="performAuthAction"]').text();
        expect(text).toBe(labels.login);
        await wrapper.find('[data-test="performAuthAction"]').trigger('click');
        await flushPromises();
        expect(utilsService.hasInternetConnection).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledOnce();
        await flushPromises();
        expect(logout).toHaveBeenCalled();
        await flushPromises();
        expect(showModalLogin).toHaveBeenCalled();
    });

    it('should handle login action', async () => {

        const fakeStore = createTestingPinia({
            fakeApp: true,
            initialState: {
                RootStore: {
                    stubActions: false,
                    createSpy: vi.fn,
                    language: PARAMETERS.DEFAULT_LANGUAGE,
                    user: { action: 'Logout' }
                }
            }
        });

        const rootStore = useRootStore(); // uses the fakeStore pinia!
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        expect(rootStore.user.action).toBe(STRINGS[language].labels.logout);
        STRINGS[language].status_codes = {
            ec5_141: 'ec5_141'
        };
        logout.mockResolvedValue(true);
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        notificationService.showAlert = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockReturnValue(true);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        menuController.close = vi.fn().mockReturnValue(true);

        const wrapper = shallowMount(LeftDrawer);

        //switch state to login action
        rootStore.user.action = labels.login;
        expect(rootStore.user.action).toBe(labels.login);
        await wrapper.vm.$nextTick();
        await wrapper.find('[data-test="performAuthAction"]').trigger('click');
        expect(logout).not.toHaveBeenCalled();
        expect(utilsService.hasInternetConnection).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(logout).toHaveBeenCalled();
        await flushPromises();
        expect(showModalLogin).toHaveBeenCalledOnce();
        await flushPromises();
    });

    it('should handle login action but device offline', async () => {

        const fakeStore = createTestingPinia({
            fakeApp: true,
            initialState: {
                RootStore: {
                    stubActions: false,
                    createSpy: vi.fn,
                    language: PARAMETERS.DEFAULT_LANGUAGE,
                    user: { action: 'Logout' }
                }
            }
        });

        const rootStore = useRootStore(); // uses the fakeStore pinia!
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        expect(rootStore.user.action).toBe(STRINGS[language].labels.logout);
        STRINGS[language].status_codes = {
            ec5_118: '--'
        };
        logout.mockResolvedValue(true);
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(false);
        notificationService.showAlert = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockReturnValue(true);
        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        menuController.close = vi.fn().mockReturnValue(true);

        const wrapper = shallowMount(LeftDrawer);

        //switch state to login action
        rootStore.user.action = labels.login;
        expect(rootStore.user.action).toBe(labels.login);
        await wrapper.vm.$nextTick();
        await wrapper.find('[data-test="performAuthAction"]').trigger('click');
        expect(logout).not.toHaveBeenCalled();
        expect(utilsService.hasInternetConnection).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_118);
        await flushPromises();
        expect(notificationService.showProgressDialog).not.toHaveBeenCalled();
        await flushPromises();
        expect(logout).not.toHaveBeenCalled();
        await flushPromises();
        expect(showModalLogin).not.toHaveBeenCalledOnce();
        await flushPromises();
    });

    it('should go to Profile page', async () => {

        const fakeStore = createTestingPinia({
            fakeApp: true,
            initialState: {
                RootStore: {
                    stubActions: false,
                    createSpy: vi.fn,
                    language: PARAMETERS.DEFAULT_LANGUAGE,
                    user: { action: 'Logout', email: 'test@gmail.com' }
                }
            }
        });

        const rootStore = useRootStore(); //use fakeStore
        const wrapper = mount(LeftDrawer);

        menuController.close = vi.fn().mockReturnValue(true);

        await flushPromises();
        await wrapper.get('[data-test="profile"]').trigger('click');
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROFILE
        });
        expect(menuController.close).toHaveBeenCalledOnce();
    });

    it('should go to Projects page', async () => {

        const wrapper = mount(LeftDrawer);

        menuController.close = vi.fn().mockReturnValue(true);

        await flushPromises();
        await wrapper.get('[data-test="projects"]').trigger('click');
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
        expect(menuController.close).toHaveBeenCalledOnce();
    });
    it('should go to Bookmarks page', async () => {

        // const wrapper = mount(LeftDrawer);

        // menuController.close = vi.fn().mockReturnValue(true);

        // await flushPromises();
        // await wrapper.get('[data-test="bookmarks"]').trigger('click');
        // await flushPromises();
        // expect(routerReplaceMock).toHaveBeenCalledOnce();
        // expect(routerReplaceMock).toHaveBeenCalledWith({
        //     name: PARAMETERS.ROUTES.BOOKMSARKS
        // });
        // expect(menuController.close).toHaveBeenCalledOnce();
    });
    it('should open Community page', async () => {

        const fakeStore = createTestingPinia({
            fakeApp: true,
            initialState: {
                RootStore: {
                    stubActions: false,
                    createSpy: vi.fn,
                    language: PARAMETERS.DEFAULT_LANGUAGE
                }
            }
        });

        const rootStore = useRootStore();
        const wrapper = mount(LeftDrawer);

        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        window.open = vi.fn();

        await wrapper.get('[data-test="community"]').trigger('click');
        await flushPromises();
        expect(utilsService.hasInternetConnection).toHaveBeenCalledOnce();
        await flushPromises();
        expect(window.open).toHaveBeenCalledOnce();
        expect(window.open).toHaveBeenCalledWith(PARAMETERS.COMMUNITY_SUPPORT_URL, '_system', 'location=yes');
    });
    it('should open User Guide page', async () => {

        const fakeStore = createTestingPinia({
            fakeApp: true,
            initialState: {
                RootStore: {
                    stubActions: false,
                    createSpy: vi.fn,
                    language: PARAMETERS.DEFAULT_LANGUAGE
                }
            }
        });

        const rootStore = useRootStore();
        const wrapper = mount(LeftDrawer);

        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        window.open = vi.fn();

        await wrapper.get('[data-test="user-guide"]').trigger('click');
        await flushPromises();
        expect(utilsService.hasInternetConnection).toHaveBeenCalledOnce();
        await flushPromises();
        expect(window.open).toHaveBeenCalledOnce();
        expect(window.open).toHaveBeenCalledWith(PARAMETERS.USER_GUIDE_URL, '_system', 'location=yes');
    });
    it('offline, should NOT open any external page', async () => {

        const rootStore = useRootStore();
        const wrapper = mount(LeftDrawer);
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        //imp: before mounting
        STRINGS[language].status_codes = {
            ec5_135: 'No Internet Connection.'
        };

        window.open = vi.fn();
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(false);
        notificationService.showAlert = vi.fn().mockReturnValue(true);

        await wrapper.get('[data-test="community"]').trigger('click');
        await flushPromises();
        expect(rootStore.language).toBe(PARAMETERS.DEFAULT_LANGUAGE);
        expect(STRINGS[rootStore.language].status_codes.ec5_135).toBe('No Internet Connection.');
        expect(utilsService.hasInternetConnection).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_135 + '!', labels.error);
        await flushPromises();
        expect(window.open).not.toHaveBeenCalled();

        await flushPromises();
        await wrapper.get('[data-test="user-guide"]').trigger('click');
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_135 + '!', labels.error);
        await flushPromises();
        expect(window.open).not.toHaveBeenCalled();
    });
});