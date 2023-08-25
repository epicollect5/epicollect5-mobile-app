import ModalAudioRecord from '@/components/modals/ModalAudioRecord.vue';
import { shallowMount } from '@vue/test-utils';
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

vi.mock('@capacitor/core', () => {
    const Capacitor = vi.fn();
    Capacitor.isNativePlatform = vi.fn();
    return { Capacitor };
});

beforeEach(() => {
    // creates a fresh pinia and make it active so it's automatically picked
    // up by any useStore() call without having to pass it to it:
    // `useStore(pinia)`
    setActivePinia(createPinia());
    vi.resetAllMocks();

});

const projectRef = '5b71f16947c34ff49b3f24756d2e2ae6';
const entryUuid = '8419e068-59de-4b8b-b095-58fa0f501d5f';
const inputRef = '5b71f16947c34ff49b3f24756d2e2ae6_60817f551ce29_60817f5af3a2b';
const type = PARAMETERS.QUESTION_TYPES.AUDIO;


// Mock resolveLocalFileSystemURL function
// window.resolveLocalFileSystemURL = vi.fn((url, successCallback, errorCallback) => {
//     // Mock the success case
//     successCallback({
//         getFile: vi.fn((filename, options, successCallback) => {
//             const mockFile = {
//                 fullPath: 'tempDir' + filename,
//                 // Mock the getFile success case
//                 createWriter: vi.fn((successCallback) => {
//                     successCallback({
//                         write: vi.fn(() => {
//                             // Mock the write success case
//                         })
//                     });
//                 })
//             };
//             successCallback(mockFile);
//         })
//     });
//     // Mock the error case
//     errorCallback();
// });

// // Mock Media constructor
// window.Media = vi.fn((file_URI, successCallback, errorCallback, onStatusChangeCallback) => {
//     const mockMedia = {
//         startRecord: vi.fn(() => {
//             // Mock startRecord method
//             successCallback();
//         }),
//         release: vi.fn(() => {
//             // Mock release method
//         })
//     };
//     return mockMedia;
// });

// Mock the required functions and objects before your test
// const resolveLocalFileSystemURLMock = vi.fn((url, successCallback) => {
//     const dirMock = {
//         getFile: vi.fn((filename, options, fileSuccessCallback) => {
//             const fileMock = {};
//             fileSuccessCallback(fileMock);
//         })
//     };
//     successCallback(dirMock);
// });
// window.resolveLocalFileSystemURL = resolveLocalFileSystemURLMock;

// const mediaRecorderStartRecordMock = vi.fn();
// const mediaRecorderMock = {
//     startRecord: mediaRecorderStartRecordMock
// };
// window.Media = vi.fn(() => mediaRecorderMock);

// Mock the required functions and objects before your test
const fileSuccessCallbackMock = vi.fn();
const resolveLocalFileSystemURLMock = vi.fn((url, successCallback) => {
    const dirMock = {
        getFile: vi.fn((filename, options, fileSuccessCallback) => {
            fileSuccessCallbackMock.mockImplementation(fileSuccessCallback);
        })
    };
    successCallback(dirMock);
});
window.resolveLocalFileSystemURL = resolveLocalFileSystemURLMock;

const mediaRecorderStartRecordMock = vi.fn();
const mediaRecorderMock = {
    startRecord: mediaRecorderStartRecordMock
};
window.Media = vi.fn(() => mediaRecorderMock);

describe('ModalAudioRecord component', () => {

    it('should be in default language', async () => {

        const rootStore = useRootStore;
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };

        expect(rootStore.device.platform).toBe(PARAMETERS.ANDROID);
        expect(rootStore.language).toBe(PARAMETERS.DEFAULT_LANGUAGE);

        const wrapper = shallowMount(ModalAudioRecord, {
            props: {
                entryUuid,
                inputRef,
                media: {
                    [entryUuid]: {
                        [inputRef]: {
                            cached: '',
                            stored: '',
                            type
                        }

                    }
                }
            }
        });


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

            const wrapper = shallowMount(ModalAudioRecord, {
                props: {
                    entryUuid,
                    inputRef,
                    media: {
                        [entryUuid]: {
                            [inputRef]: {
                                cached: '',
                                stored: '',
                                type
                            }

                        }
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
});