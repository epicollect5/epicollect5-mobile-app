import ModalAccountDeletion from '@/components/modals/ModalAccountDeletion.vue';
import { mount, shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { notificationService } from '@/services/notification-service';
import { webService } from '@/services/web-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { useDBStore } from '@/stores/db-store';
import flushPromises from 'flush-promises';
import { modalController, loadingController } from '@ionic/vue';
import { logout } from '@/use/logout';
import { showModalLogin } from '@/use/show-modal-login';


const email = 'joe@gmail.com';
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


// vi.mock('@/services/web-service', () => {
//     const webService = vi.fn();

//     webService.requestAccountDeletion = vi.fn().mockResolvedValue('asdfas');

//     return { webService };
// });

const routerReplaceMock = vi.fn();

vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: routerReplaceMock
        // You can add more router methods here if needed
    })
}));

beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    // up by any useStore() call without having to pass it to it:
    // `useStore(pinia)`
    setActivePinia(createPinia());
    vi.resetAllMocks();

});

describe('ModalAccountDeletion component', () => {


    it('should be in default language', async () => {
        const wrapper = mount(ModalAccountDeletion, {
            props: {
                email
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

        const rootStore = useRootStore();
        const email = 'joe@gmail.com';

        PARAMETERS.SUPPORTED_LANGUAGES.forEach((language) => {
            rootStore.language = language;

            const wrapper = mount(ModalAccountDeletion, {
                props: {
                    email
                }
            });

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

    it('should show user email', async () => {
        const email = 'joe@gmail.com';
        const wrapper = mount(ModalAccountDeletion, {
            props: {
                email
            }
        });

        expect(wrapper.get('[data-test="email"]').text()).toBe(email);
    });

    it('should request deletion onConfirm()', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const email = 'test@example.com';
        STRINGS[language].status_codes = {
            ec5_385: 'Account disconnected.'
        };

        errorsService.handleWebError = vi.fn().mockResolvedValue('ok');

        // Mock your utilities, services, and router as needed
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        utilsService.isJWTExpired = vi.fn().mockResolvedValue(false);

        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockReturnValue(true);

        webService.requestAccountDeletion = vi.fn().mockResolvedValue({ data: { data: { accepted: true } } });

        modalController.dismiss = vi.fn().mockReturnValue(true);
        loadingController.present = vi.fn().mockResolvedValue(true);

        const wrapper = shallowMount(ModalAccountDeletion, {
            props: {
                email
            }
        });

        // Trigger the onConfirm method
        await wrapper.get('[data-test="confirm"]').trigger('click');

        // Assertions for method calls and behavior
        expect(utilsService.hasInternetConnection).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.wait);
        await flushPromises();
        expect(webService.requestAccountDeletion).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.account_deletion_request_sent);
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_385);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
    });

    it('should perform deletion onConfirm()', async () => {

        const dbStore = useDBStore();
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const email = 'test@example.com';
        // dbStore.db.transaction = vi.fn();

        STRINGS[language].status_codes = {
            ec5_385: 'Account disconnected.'
        };

        errorsService.handleWebError = vi.fn().mockResolvedValue('ok');

        // Mock your utilities, services, and router as needed
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        utilsService.isJWTExpired = vi.fn().mockResolvedValue(false);

        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);

        modalController.dismiss = vi.fn().mockReturnValue(true);
        loadingController.present = vi.fn().mockResolvedValue(true);


        // Mock response for webService
        webService.requestAccountDeletion = vi.fn().mockResolvedValue({ data: { data: { deleted: true } } });

        const wrapper = shallowMount(ModalAccountDeletion, {
            props: {
                email
            }
        });

        // Trigger the onConfirm method
        await wrapper.get('[data-test="confirm"]').trigger('click');

        // Assertions for method calls and behavior
        expect(utilsService.hasInternetConnection).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.wait);
        await flushPromises();
        expect(webService.requestAccountDeletion).toHaveBeenCalled();
        await flushPromises();
        await expect(webService.requestAccountDeletion()).resolves.toEqual({ data: { data: { deleted: true } } });

        expect(notificationService.showAlert).not.toHaveBeenCalledWith(labels.account_deletion_request_sent);
        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_385);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
    });

    it('should bail out if offline', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const email = 'test@example.com';

        STRINGS[language].status_codes = {
            ec5_118: 'Please connect to the internet to login.'
        };

        errorsService.handleWebError = vi.fn().mockResolvedValue('ok');

        // Mock your utilities, services, and router as needed
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(false);
        utilsService.isJWTExpired = vi.fn().mockResolvedValue(false);

        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);

        modalController.dismiss = vi.fn().mockReturnValue(true);
        loadingController.present = vi.fn().mockResolvedValue(true);


        // Mock response for webService
        webService.requestAccountDeletion = vi.fn().mockResolvedValue({ data: { data: { deleted: true } } });

        const wrapper = shallowMount(ModalAccountDeletion, {
            props: {
                email
            }
        });

        // Trigger the onConfirm method
        await wrapper.get('[data-test="confirm"]').trigger('click');

        // Assertions for method calls and behavior
        expect(utilsService.hasInternetConnection).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showProgressDialog).not.toHaveBeenCalledWith(labels.wait);
        await flushPromises();
        expect(webService.requestAccountDeletion).not.toHaveBeenCalled();

        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_118);
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(labels.account_deletion_request_sent);
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_385);
        await flushPromises();
        expect(notificationService.hideProgressDialog).not.toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).not.toHaveBeenCalledOnce();
        expect(routerReplaceMock).not.toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
        await flushPromises();
    });

    it('should catch network error', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const email = 'test@example.com';

        STRINGS[language].status_codes = {
            ec5_116: 'Server error, please try again later.'
        };

        errorsService.handleWebError = vi.fn().mockResolvedValue('ok');

        // Mock your utilities, services, and router as needed
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        utilsService.isJWTExpired = vi.fn().mockResolvedValue(false);

        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);

        modalController.dismiss = vi.fn().mockReturnValue(true);
        loadingController.present = vi.fn().mockResolvedValue(true);


        // Mock response for webService
        webService.requestAccountDeletion = vi.fn().mockImplementation(() => {
            throw new Error('Network error');
        });

        const wrapper = shallowMount(ModalAccountDeletion, {
            props: {
                email
            }
        });

        // Trigger the onConfirm method
        await wrapper.get('[data-test="confirm"]').trigger('click');

        // Assertions for method calls and behavior
        expect(utilsService.hasInternetConnection).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.wait);
        await flushPromises();
        expect(webService.requestAccountDeletion).toHaveBeenCalled();

        expect(errorsService.handleWebError).toHaveBeenCalled();
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(labels.account_deletion_request_sent);
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_385);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
    });

    it('should catch wrong response', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const email = 'test@example.com';

        STRINGS[language].status_codes = {
            ec5_116: 'Server error, please try again later.'
        };

        errorsService.handleWebError = vi.fn().mockResolvedValue('ok');

        // Mock your utilities, services, and router as needed
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        utilsService.isJWTExpired = vi.fn().mockResolvedValue(false);

        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);

        modalController.dismiss = vi.fn().mockReturnValue(true);
        loadingController.present = vi.fn().mockResolvedValue(true);


        // Mock response for webService
        webService.requestAccountDeletion = vi.fn().mockResolvedValue({ data: { data: { fake: true } } });


        const wrapper = shallowMount(ModalAccountDeletion, {
            props: {
                email
            }
        });

        // Trigger the onConfirm method
        await wrapper.get('[data-test="confirm"]').trigger('click');

        // Assertions for method calls and behavior
        expect(utilsService.hasInternetConnection).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.wait);
        await flushPromises();
        expect(webService.requestAccountDeletion).toHaveBeenCalled();

        expect(errorsService.handleWebError).not.toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_116);
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(labels.account_deletion_request_sent);
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_385);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
    });

    it('should catch expired JWT', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const email = 'test@example.com';

        STRINGS[language].status_codes = {
            ec5_116: 'Server error, please try again later.'
        };

        errorsService.handleWebError = vi.fn().mockResolvedValue('ok');

        // Mock your utilities, services, and router as needed
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        utilsService.isJWTExpired = vi.fn().mockResolvedValue(true);

        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);

        modalController.dismiss = vi.fn().mockReturnValue(true);
        loadingController.present = vi.fn().mockResolvedValue(true);

        // Mock response for webService
        webService.requestAccountDeletion = vi.fn().mockRejectedValue({
            data: {
                errors: [{ code: 'ec5_219' }]
            }
        });

        const wrapper = shallowMount(ModalAccountDeletion, {
            props: {
                email
            }
        });

        // Trigger the onConfirm method
        await wrapper.get('[data-test="confirm"]').trigger('click');

        // Assertions for method calls and behavior
        expect(utilsService.hasInternetConnection).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.wait);
        await flushPromises();
        expect(webService.requestAccountDeletion).toHaveBeenCalled();
        await flushPromises();
        await expect(webService.requestAccountDeletion).rejects.toEqual({
            data: {
                errors: [{ code: 'ec5_219' }]
            }
        });
        await flushPromises();

        expect(errorsService.handleWebError).not.toHaveBeenCalled();
        expect(showModalLogin).toHaveBeenCalledOnce();
        expect(logout).toHaveBeenCalledOnce();
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(labels.account_deletion_request_sent);
        expect(notificationService.showAlert).not.toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_385);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
    });

    it('should catch random error response', async () => {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        const email = 'test@example.com';

        STRINGS[language].status_codes = {
            ec5_103: 'Unknown error.'
        };

        errorsService.handleWebError = vi.fn().mockResolvedValue('ok');

        // Mock your utilities, services, and router as needed
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        utilsService.isJWTExpired = vi.fn().mockResolvedValue(false);

        notificationService.showProgressDialog = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);

        modalController.dismiss = vi.fn().mockReturnValue(true);
        loadingController.present = vi.fn().mockResolvedValue(true);

        // Mock response for webService
        webService.requestAccountDeletion = vi.fn().mockRejectedValue({
            data: {
                errors: [{ code: 'ec5_103' }]
            }
        });

        const wrapper = shallowMount(ModalAccountDeletion, {
            props: {
                email
            }
        });

        // Trigger the onConfirm method
        await wrapper.get('[data-test="confirm"]').trigger('click');

        // Assertions for method calls and behavior
        expect(utilsService.hasInternetConnection).toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showProgressDialog).toHaveBeenCalledWith(labels.wait);
        await flushPromises();
        expect(webService.requestAccountDeletion).toHaveBeenCalled();
        await flushPromises();
        await expect(webService.requestAccountDeletion).rejects.toEqual({
            data: {
                errors: [{ code: 'ec5_103' }]
            }
        });
        await flushPromises();

        expect(errorsService.handleWebError).toHaveBeenCalledWith({
            data: {
                errors: [{ code: 'ec5_103' }]
            }
        });
        expect(showModalLogin).not.toHaveBeenCalled();
        expect(logout).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        await flushPromises();
        expect(routerReplaceMock).toHaveBeenCalledOnce();
        expect(routerReplaceMock).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
    });
});