import ModalPhoto from '@/components/modals/ModalPhoto.vue';
import { mount, shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { Share } from '@capacitor/share';


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

describe('ModalPhoto component', () => {

    it('should be in default language', async () => {

        const wrapper = mount(ModalPhoto, {
            props: {
                isPWA: false,
                imageSource: '/path/to/image',
                fileSource: '/path/to-file'
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

            const wrapper = mount(ModalPhoto, {
                props: {
                    isPWA: false,
                    imageSource: '/path/to/image',
                    fileSource: '/path/to-file'
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

    it('should show share button on Android', () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        const wrapper = mount(ModalPhoto, {
            props: {
                isPWA: false,
                imageSource: '/path/to/image',
                fileSource: '/path/to-file'
            }
        });
        expect(wrapper.find('[data-test="share"]').exists()).toBe(true);
    });

    it('should show share button on iOS', () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.IOS;
        const wrapper = mount(ModalPhoto, {
            props: {
                isPWA: false,
                imageSource: '/path/to/image',
                fileSource: '/path/to-file'
            }
        });
        expect(wrapper.find('[data-test="share"]').exists()).toBe(true);
    });

    it('should not show share button on PWA', () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.PWA;
        const wrapper = mount(ModalPhoto, {
            props: {
                isPWA: true,
                imageSource: '/path/to/image',
                fileSource: '/path/to-file'
            }
        });
        expect(wrapper.find('[data-test="share"]').exists()).not.toBe(true);
    });

    it('should call share plugin on click', () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        const wrapper = mount(ModalPhoto, {
            props: {
                isPWA: false,
                imageSource: '/path/to/image',
                fileSource: '/path/to-file'
            }
        });

        Share.share = vi.fn().mockReturnValue(true);
        expect(wrapper.find('[data-test="share"]').exists()).toBe(true);
        const buttonShare = wrapper.find('[data-test="share"]');
        buttonShare.trigger('click');
        expect(Share.share).toHaveBeenCalled();
        expect(Share.share).toHaveBeenCalledWith({
            title: '',
            text: '',
            url: 'file://' + wrapper.props('fileSource'),
            dialogTitle: ''
        });
    });

    it('should hide spinner on image loaded', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        const wrapper = mount(ModalPhoto, {
            props: {
                isPWA: false,
                imageSource: '/path/to/image',
                fileSource: '/path/to-file'
            }
        });

        expect(wrapper.find('[data-test="share"]').exists()).toBe(true);
        expect(wrapper.find('[data-test="spinner"]').isVisible()).toBe(true);
        await wrapper.vm.onImageLoad();
        await wrapper.vm.$nextTick();
        expect(wrapper.find('[data-test="spinner"]').isVisible()).toBe(false);
    });
});