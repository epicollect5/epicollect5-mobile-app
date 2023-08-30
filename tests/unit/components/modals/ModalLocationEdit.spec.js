import ModalLocationEdit from '@/components/modals/ModalLocationEdit.vue';
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

describe('ModalLocationEdit component', () => {

    it('should be in default language', async () => {

        const wrapper = mount(ModalLocationEdit, {
            props: {
                latitude: '',
                longitude: ''
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

            const wrapper = mount(ModalLocationEdit, {
                props: {
                    latitude: '',
                    longitude: ''
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

    it('should update location on dismiss modal', () => {

        const latitude = '37.774911';
        const longitude = '-122.419111';
        const wrapper = mount(ModalLocationEdit, {
            props: {
                latitude,
                longitude
            }
        });

        modalController.dismiss = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);

        const updateLocationButton = wrapper.find('[data-test="update-location"]');

        updateLocationButton.trigger('click');
        expect(modalController.dismiss).toHaveBeenCalledWith({
            latitude,
            longitude
        });
        expect(notificationService.showAlert).not.toHaveBeenCalled();
    });

    it('should catch invalid lat and long', () => {

        const labels = STRINGS[PARAMETERS.DEFAULT_LANGUAGE].labels;
        const latitude = '';
        const longitude = '';
        const wrapper = mount(ModalLocationEdit, {
            props: {
                latitude,
                longitude
            }
        });

        modalController.dismiss = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);

        const updateLocationButton = wrapper.find('[data-test="update-location"]');

        updateLocationButton.trigger('click');
        expect(modalController.dismiss).not.toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith(labels.invalid_value);
    });
});