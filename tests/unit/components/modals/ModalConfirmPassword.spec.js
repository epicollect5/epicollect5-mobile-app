import ModalConfirmPassword from '@/components/modals/ModalConfirmPassword.vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { eye, eyeOff } from 'ionicons/icons';
import { loginLocal } from '@/use/login-local';



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

vi.mock('@/use/login-local', () => {
    const loginLocal = vi.fn();
    return { loginLocal };
});

beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    // up by any useStore() call without having to pass it to it:
    // `useStore(pinia)`
    setActivePinia(createPinia());
    vi.resetAllMocks();
});

describe('ModalConfirmPassword component', () => {

    it('should be in default language', async () => {

        const wrapper = mount(ModalConfirmPassword, {
            props: {
                email: 'test@gmail.com'
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

            const wrapper = mount(ModalConfirmPassword, {
                props: {
                    email: 'test@gmail.com'
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

    it('should toggle password visibility', async () => {

        const wrapper = mount(ModalConfirmPassword, {
            props: {
                email: 'test@gmail.com'
            }
        });

        expect(wrapper.vm.state.authLocalInputPasswordType).toBe('password');
        expect(wrapper.vm.state.eyeIcon).toBe(eye);
        const eyeIcon = wrapper.find('[data-test="toggle-input-type"]');
        eyeIcon.trigger('click');
        expect(wrapper.vm.state.authLocalInputPasswordType).toBe('text');
        expect(wrapper.vm.state.eyeIcon).toBe(eyeOff);
    });

    it('should authorise local user', async () => {

        const email = 'test@gmail.com';
        const password = 'my-password';
        const wrapper = mount(ModalConfirmPassword, {
            props: {
                email
            }
        });

        const loginButton = wrapper.find('[data-test="login"]');
        expect(loginButton.element.disabled).toBe(true);

        wrapper.vm.state.password = password;
        await wrapper.vm.$nextTick();
        expect(loginButton.element.disabled).toBe(false);
        loginButton.trigger('click');
        expect(loginLocal).toHaveBeenCalledWith({ email, password });
    });

    it('should show user email', async () => {

        const email = 'test@gmail.com';
        const wrapper = mount(ModalConfirmPassword, {
            props: {
                email
            }
        });

        const emailLabel = wrapper.find('[data-test="email"]');
        expect(emailLabel.text()).toBe(email);
    });
});