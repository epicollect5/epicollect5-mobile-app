import ModalBookmarkAdd from '@/components/modals/ModalBookmarkAdd.vue';
import { mount, shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { createTestingPinia } from '@pinia/testing';
import { notificationService } from '@/services/notification-service';
import { webService } from '@/services/web-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { useDBStore } from '@/stores/db-store';
import flushPromises from 'flush-promises';
import { modalController, loadingController } from '@ionic/vue';

const projectRef = '5b71f16947c34ff49b3f24756d2e2ae6';
const entryUuid = '8419e068-59de-4b8b-b095-58fa0f501d5f';
const inputRef = '5b71f16947c34ff49b3f24756d2e2ae6_60817f551ce29_60817f5af3a2b';
const bookmarkTitle = 'The bookmark title';
const formRef = '5b71f16947c34ff49b3f24756d2e2ae6_60817f551ce29';


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

describe('ModalBookmarkAdd component', () => {

    it('should be in default language', async () => {

        const wrapper = mount(ModalBookmarkAdd, {
            props: {
                projectRef,
                bookmarkTitle,
                formRef
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

            const wrapper = mount(ModalBookmarkAdd, {
                props: {
                    projectRef,
                    bookmarkTitle,
                    formRef
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

    it('should avoid invalid bookmark titles', async () => {
        const rootStore = useRootStore();
        rootStore.device = {
            platform: PARAMETERS.WEB
        };
        const wrapper = mount(ModalBookmarkAdd, {
            props: {
                projectRef,
                bookmarkTitle,
                formRef
            }
        });

        // Get the reactive state object
        const state = wrapper.vm.state;
        const divElement = wrapper.find('div[data-translate="invalid_value"]');
        expect(divElement.classes()).toContain('bookmark-title-success');
        expect(divElement.classes()).not.toContain('bookmark-title-error');
        const buttonBookmarkAdd = wrapper.find('[data-test="bookmark-add"]');
        expect(buttonBookmarkAdd.element.disabled).toBe(false);

        const invalidStrings = [
            '',
            'Hello!',
            'testing#123',
            'foo@bar',
            'no*spaces',
            'special%characters',
            '<>',
            ':;',
            '?',
            '<script>alert(\'ops\')</script>',
            '!@#$%^&*()',
            '',
            '.',
            '""',
            '[]',
            '{}'
        ];

        for (const invalidString of invalidStrings) {
            state.bookmarkTitle = invalidString;
            await wrapper.vm.$nextTick();

            const divElement = wrapper.find('div[data-translate="invalid_value"]');
            expect(divElement.classes()).not.toContain('bookmark-title-success');
            expect(divElement.classes()).toContain('bookmark-title-error');
            const buttonBookmarkAdd = wrapper.find('[data-test="bookmark-add"]');
            expect(buttonBookmarkAdd.element.disabled).toBe(true);
        }
    });

    it('should add current page to bookmarks', async () => {

        const rootStore = useRootStore();
        const boomarkStore = useBookmarkStore();
        const language = rootStore.language;
        STRINGS[language].status_codes = {
            ec5_126: '---',
            ec5_104: '---'
        };
        rootStore.device = {
            platform: PARAMETERS.WEB
        };

        const wrapper = mount(ModalBookmarkAdd, {
            props: {
                projectRef,
                bookmarkTitle,
                formRef
            }
        });

        const divElement = wrapper.find('div[data-translate="invalid_value"]');
        expect(divElement.classes()).toContain('bookmark-title-success');
        expect(divElement.classes()).not.toContain('bookmark-title-error');
        const buttonBookmarkAdd = wrapper.find('[data-test="bookmark-add"]');
        expect(buttonBookmarkAdd.element.disabled).toBe(false);

        //999 as bookmarkId
        bookmarksService.insertBookmark = vi.fn().mockResolvedValue(999);
        modalController.dismiss = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockReturnValue(true);
        buttonBookmarkAdd.trigger('click');
        expect(bookmarksService.insertBookmark).toHaveBeenCalledWith(
            projectRef,
            formRef,
            bookmarkTitle
        );
        await flushPromises();
        expect(notificationService.showToast).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_126
        );
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
        await flushPromises();
        expect(boomarkStore.bookmarkId).toBe(999);
    });

    it('should catch bookmark add error', async () => {

        const rootStore = useRootStore();
        const boomarkStore = useBookmarkStore();
        const language = rootStore.language;
        STRINGS[language].status_codes = {
            ec5_126: '---',
            ec5_104: '---'
        };
        rootStore.device = {
            platform: PARAMETERS.WEB
        };

        const wrapper = mount(ModalBookmarkAdd, {
            props: {
                projectRef,
                bookmarkTitle,
                formRef
            }
        });

        const divElement = wrapper.find('div[data-translate="invalid_value"]');
        expect(divElement.classes()).toContain('bookmark-title-success');
        expect(divElement.classes()).not.toContain('bookmark-title-error');
        const buttonBookmarkAdd = wrapper.find('[data-test="bookmark-add"]');
        expect(buttonBookmarkAdd.element.disabled).toBe(false);

        //999 as bookmarkId
        bookmarksService.insertBookmark = vi.fn().mockImplementation(() => {
            throw new Error('Mocked error');
        });
        modalController.dismiss = vi.fn().mockReturnValue(true);
        notificationService.showToast = vi.fn().mockReturnValue(true);
        notificationService.showAlert = vi.fn().mockReturnValue(true);
        buttonBookmarkAdd.trigger('click');
        expect(bookmarksService.insertBookmark).toHaveBeenCalledWith(
            projectRef,
            formRef,
            bookmarkTitle
        );
        await flushPromises();
        expect(notificationService.showToast).not.toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_126
        );
        await flushPromises();
        expect(notificationService.showAlert).toHaveBeenCalledWith(
            STRINGS[language].status_codes.ec5_104
        );
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
        await flushPromises();
        expect(boomarkStore.bookmarkId).toBe(null);
    });
});