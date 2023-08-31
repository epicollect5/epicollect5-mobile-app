import ModalProjectInfo from '@/components/modals/ModalProjectInfo.vue';
import { mount, shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import flushPromises from 'flush-promises';
import { utilsService } from '@/services/utilities/utils-service';
import { notificationService } from '@/services/notification-service';

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
    projectModel.getSlug = vi.fn();
    return { projectModel };
});

beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    // up by any useStore() call without having to pass it to it:
    // `useStore(pinia)`
    setActivePinia(createPinia());
    vi.resetAllMocks();
});

describe('ModalProjectInfo component', () => {

    it('should be in default language', async () => {

        const wrapper = mount(ModalProjectInfo, {
            props: {
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

            const wrapper = mount(ModalProjectInfo, {
                props: {
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

    it('should open project home page', async () => {
        const wrapper = mount(ModalProjectInfo, {
            props: {
            }
        });
        const slug = 'the-slug';

        projectModel.getSlug = vi.fn().mockReturnValue(slug);
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(true);
        window.open = vi.fn();
        const button = wrapper.find('[data-test="goto-project-home-page"]');
        button.trigger('click');
        expect(utilsService.hasInternetConnection).toHaveBeenCalledOnce();
        await flushPromises();
        expect(window.open).toHaveBeenCalledWith(PARAMETERS.DEFAULT_SERVER_URL + PARAMETERS.API.ROUTES.PROJECT + slug, '_system', 'location=yes');
    });

    it('should not open project home page if offline', async () => {

        const language = PARAMETERS.DEFAULT_LANGUAGE;
        const labels = STRINGS[language].labels;
        const wrapper = mount(ModalProjectInfo, {
            props: {
            }
        });
        const slug = 'the-slug';
        STRINGS[language].status_codes = {
            ec5_135: '---'
        };

        projectModel.getSlug = vi.fn().mockReturnValue(slug);
        utilsService.hasInternetConnection = vi.fn().mockResolvedValue(false);
        notificationService.showAlert = vi.fn().mockResolvedValue(true);
        window.open = vi.fn();
        const button = wrapper.find('[data-test="goto-project-home-page"]');
        button.trigger('click');
        expect(utilsService.hasInternetConnection).toHaveBeenCalledOnce();
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_135 + '!', labels.error
        );
        expect(window.open).not.toHaveBeenCalled();
    });
});