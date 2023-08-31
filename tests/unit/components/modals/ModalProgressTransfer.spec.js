import ModalProgressTransfer from '@/components/modals/ModalProgressTransfer.vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';


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

vi.mock('@capacitor/share', () => {
    const Share = vi.fn();
    return { Share };
});

beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    // up by any useStore() call without having to pass it to it:
    // `useStore(pinia)`
    setActivePinia(createPinia());
    vi.resetAllMocks();
});

describe('ModalProgressTransfer component', () => {

    it('should be in default language', async () => {

        const wrapper = mount(ModalProgressTransfer, {
            props: {
                header: 'The header'
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

            const wrapper = mount(ModalProgressTransfer, {
                props: {
                    header: 'The header'
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

    it('should display progress', async () => {
        const rootStore = useRootStore();
        const total = 10;
        let done = 0;
        rootStore.progressTransfer = {
            total,
            done
        };
        const wrapper = mount(ModalProgressTransfer, {
            props: {
                header: 'The header'
            }
        });

        //0/10
        let progressElement = wrapper.find('[data-test="progress"]');
        expect(progressElement.exists()).toBe(true);
        expect(progressElement.text()).toBe(done + '/' + total);

        //1/10
        done++;
        rootStore.progressTransfer.done = done;
        await wrapper.vm.$nextTick();
        progressElement = wrapper.find('[data-test="progress"]');
        expect(progressElement.exists()).toBe(true);
        expect(progressElement.text()).toBe(done + '/' + total);

        //...and so on
        done++;
        rootStore.progressTransfer.done = done;
        await wrapper.vm.$nextTick();
        progressElement = wrapper.find('[data-test="progress"]');
        expect(progressElement.exists()).toBe(true);
        expect(progressElement.text()).toBe(done + '/' + total);

        done++;
        rootStore.progressTransfer.done = done;
        await wrapper.vm.$nextTick();
        progressElement = wrapper.find('[data-test="progress"]');
        expect(progressElement.exists()).toBe(true);
        expect(progressElement.text()).toBe(done + '/' + total);

        done++;
        rootStore.progressTransfer.done = done;
        await wrapper.vm.$nextTick();
        progressElement = wrapper.find('[data-test="progress"]');
        expect(progressElement.exists()).toBe(true);
        expect(progressElement.text()).toBe(done + '/' + total);

        done++;
        rootStore.progressTransfer.done = done;
        await wrapper.vm.$nextTick();
        progressElement = wrapper.find('[data-test="progress"]');
        expect(progressElement.exists()).toBe(true);
        expect(progressElement.text()).toBe(done + '/' + total);
    });

    it('should display header via props', async () => {
        const rootStore = useRootStore();
        const total = 10;
        const done = 0;
        rootStore.progressTransfer = {
            total,
            done
        };
        const wrapper = mount(ModalProgressTransfer, {
            props: {
                header: 'The header'
            }
        });

        const headerElement = wrapper.find('[data-test="header"]');
        expect(headerElement.exists()).toBe(true);
        expect(headerElement.text()).toBe(wrapper.props('header'));
    });
});