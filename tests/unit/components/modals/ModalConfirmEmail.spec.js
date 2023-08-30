import ModalConfirmEmail from '@/components/modals/ModalConfirmEmail.vue';
import { mount, shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createTestingPinia } from '@pinia/testing';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { modalController } from '@ionic/vue';
import { notificationService } from '@/services/notification-service';
import { authVerificationService } from '@/services/auth/auth-verification-service';
import { authLoginService } from '@/services/auth/auth-login-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';
import flushPromises from 'flush-promises';

const routerReplaceMock = vi.fn();
vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: routerReplaceMock
        // You can add more router methods here if needed
    })
}));

vi.mock('@/models/project-model', () => {
    const projectModel = vi.fn();
    projectModel.getExtraInputs = vi.fn();
    projectModel.getFormGroups = vi.fn();
    projectModel.getProjectName = vi.fn();
    projectModel.getSmallDescription = vi.fn();
    projectModel.getDescription = vi.fn();
    return { projectModel };
});

beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    // up by any useStore() call without having to pass it to it:
    // `useStore(pinia)`
    setActivePinia(createPinia());
    vi.resetAllMocks();
});

describe('ModalConfirmEmail component', () => {

    it('should be in default language', async () => {

        const wrapper = mount(ModalConfirmEmail, {
            props: {
                account: {
                    user: 'Mirko',
                    email: 'test@gmail.com',
                    provider: 'google'
                }
            }
        });

        const rootStore = useRootStore;
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;

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

        const rootStore = useRootStore();

        PARAMETERS.SUPPORTED_LANGUAGES.forEach((language) => {
            rootStore.language = language;

            const wrapper = mount(ModalConfirmEmail, {
                props: {
                    account: {
                        user: 'Mirko',
                        email: 'test@gmail.com',
                        provider: 'google'
                    }
                }
            });

            wrapper.findAll('[data-translate]').forEach((el) => {
                const key = el.attributes('data-translate');
                // console.log(`Testing translation for key: ${key}`);

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

    it('should catch invalid code length', async () => {
        const wrapper = mount(ModalConfirmEmail, {
            props: {
                account: {
                    user: 'Mirko',
                    email: 'test@gmail.com',
                    provider: 'google'
                }
            }
        });

        const state = wrapper.vm.state;

        let buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(true);

        state.code = '1';
        await wrapper.vm.$nextTick();
        buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(true);

        state.code = '12';
        await wrapper.vm.$nextTick();
        buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(true);

        state.code = '123';
        await wrapper.vm.$nextTick();
        buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(true);

        state.code = '1234';
        await wrapper.vm.$nextTick();
        buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(true);

        state.code = '12345';
        await wrapper.vm.$nextTick();
        buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(true);

        state.code = '123456';
        await wrapper.vm.$nextTick();
        buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(false);

        state.code = '1234567';
        await wrapper.vm.$nextTick();
        buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(true);

        state.code = '1234568';
        await wrapper.vm.$nextTick();
        buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(true);
    });

    it('should verify user (without callback)', async () => {
        const rootStore = useRootStore();
        const language = rootStore.language;
        STRINGS[language].status_codes = {
            ec5_115: '---'
        };
        const accountMock = {
            user: 'Mirko',
            email: 'test@gmail.com',
            provider: 'google'
        };
        const responseMock = {
            data: {
                type: 'jwt',
                jwt: 'xxxxxxxxx'
            },
            meta: {
                user: 'xxx',
                email: 'xxx'
            }
        };
        const wrapper = mount(ModalConfirmEmail, {
            props: {
                account: accountMock
            }
        });

        authVerificationService.verifyUser = vi.fn().mockResolvedValue(responseMock);
        authLoginService.loginUser = vi.fn().mockResolvedValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        modalsHandlerService.dismissAll = vi.fn().mockReturnValue(true);
        rootStore.afterUserIsLoggedIn.callback = null;

        const state = wrapper.vm.state;
        state.code = '123456';
        await wrapper.vm.$nextTick();

        const credentials = {
            email: accountMock.email,
            code: state.code,
            user: accountMock.user,
            provider: accountMock.provider
        };

        const buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(false);
        buttonLogin.trigger('click');
        expect(authVerificationService.verifyUser).toHaveBeenCalledWith(credentials);
        await flushPromises();
        expect(authLoginService.loginUser).toHaveBeenCalledOnce();
        expect(authLoginService.loginUser).toHaveBeenCalledWith(responseMock);
        await flushPromises();
        expect(modalsHandlerService.dismissAll).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_115);
        await flushPromises();
    });

    it('should verify user (with callback)', async () => {

        const accountMock = {
            user: 'Mirko',
            email: 'test@gmail.com',
            provider: 'google'
        };
        const responseMock = {
            data: {
                type: 'jwt',
                jwt: 'xxxxxxxxx'
            },
            meta: {
                user: 'xxx',
                email: 'xxx'
            }
        };
        const callbackMock = vi.fn().mockResolvedValue(true);
        const wrapper = mount(ModalConfirmEmail, {
            props: {
                account: accountMock
            }
        });

        const rootStore = useRootStore();//use testing pinia!
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        const language = rootStore.language;
        STRINGS[language].status_codes = {
            ec5_115: '---'
        };

        authVerificationService.verifyUser = vi.fn().mockResolvedValue(responseMock);
        authLoginService.loginUser = vi.fn().mockResolvedValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.hideProgressDialog = vi.fn().mockResolvedValue(true);
        modalsHandlerService.dismissAll = vi.fn().mockReturnValue(true);
        rootStore.afterUserIsLoggedIn = {
            callback: callbackMock,
            params: [1, 2, 3]
        };
        expect(rootStore.afterUserIsLoggedIn.callback).not.toBe(null);

        const state = wrapper.vm.state;
        state.code = '123456';
        await wrapper.vm.$nextTick();

        const credentials = {
            email: accountMock.email,
            code: state.code,
            user: accountMock.user,
            provider: accountMock.provider
        };


        const buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(false);
        buttonLogin.trigger('click');
        expect(authVerificationService.verifyUser).toHaveBeenCalledWith(credentials);
        await flushPromises();
        expect(authLoginService.loginUser).toHaveBeenCalledOnce();
        expect(authLoginService.loginUser).toHaveBeenCalledWith(responseMock);
        await flushPromises();
        expect(modalsHandlerService.dismissAll).toHaveBeenCalledOnce();
        expect(callbackMock).toHaveBeenCalledWith(
            1, 2, 3
        );
        await flushPromises();
        expect(notificationService.hideProgressDialog).not.toHaveBeenCalled();
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(STRINGS['en'].status_codes.ec5_115);
        await flushPromises();
    });

    it('should catch response error', async () => {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const errorCode = 'ec5_115';
        STRINGS[language].status_codes = {
            ec5_115: '---'
        };
        const accountMock = {
            user: 'Mirko',
            email: 'test@gmail.com',
            provider: 'google'
        };

        const wrapper = mount(ModalConfirmEmail, {
            props: {
                account: accountMock
            }
        });

        authVerificationService.verifyUser = vi.fn().mockRejectedValue(errorCode);
        authLoginService.loginUser = vi.fn().mockResolvedValue(true);
        notificationService.showToast = vi.fn().mockResolvedValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);
        modalsHandlerService.dismissAll = vi.fn().mockReturnValue(true);
        notificationService.hideProgressDialog = vi.fn().mockReturnValue(true);
        rootStore.afterUserIsLoggedIn.callback = null;

        const state = wrapper.vm.state;
        state.code = '123456';
        await wrapper.vm.$nextTick();

        const credentials = {
            email: accountMock.email,
            code: state.code,
            user: accountMock.user,
            provider: accountMock.provider
        };

        const buttonLogin = wrapper.find('[data-test="login"]');
        expect(buttonLogin.element.disabled).toBe(false);
        buttonLogin.trigger('click');
        expect(authVerificationService.verifyUser).toHaveBeenCalledWith(credentials);
        await flushPromises();
        expect(authLoginService.loginUser).not.toHaveBeenCalledOnce();
        await flushPromises();
        expect(modalsHandlerService.dismissAll).not.toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalledWith(STRINGS[language].status_codes.ec5_115);
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(STRINGS[language].status_codes[errorCode]);
        await flushPromises();
        expect(notificationService.hideProgressDialog).toHaveBeenCalledOnce();
    });
});