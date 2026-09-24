import ModalAudioRecord from '@/components/modals/ModalAudioRecord.vue';
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { notificationService } from '@/services/notification-service';
import { modalController } from '@ionic/vue';


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

const rollbarMock = vi.hoisted(() => ({ critical: vi.fn(), criticalWithContext: vi.fn() }));

vi.mock('@/services/utilities/rollbar-service', () => ({ rollbarService: rollbarMock }));

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
const mediaRecorderStopRecordMock = vi.fn();
const mediaRecorderReleaseMock = vi.fn();
const mediaRecorderMock = {
    startRecord: mediaRecorderStartRecordMock,
    stopRecord: mediaRecorderStopRecordMock,
    release: mediaRecorderReleaseMock
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

    //mount with the file system callback wired up, so the native recorder is
    //actually constructed and stop() has something to stop
    async function mountRecorder() {
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
        await fileSuccessCallbackMock({});
        return wrapper;
    }

    it('ignores a second stop tap', async () => {
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };
        rootStore.tempDir = 'temp/';
        notificationService.showProgressDialog = vi.fn(() => Promise.resolve());
        notificationService.hideProgressDialog = vi.fn();
        notificationService.showToast = vi.fn();
        modalController.dismiss = vi.fn(() => Promise.resolve());

        const wrapper = await mountRecorder();

        //double-tap: both taps land before the saving dialog yields, so the
        //second one would otherwise release the recorder a second time
        const firstStop = wrapper.vm.stop();
        const secondStop = wrapper.vm.stop();
        await Promise.all([firstStop, secondStop]);

        expect(mediaRecorderStopRecordMock).toHaveBeenCalledTimes(1);
        expect(mediaRecorderReleaseMock).toHaveBeenCalledTimes(1);
        expect(modalController.dismiss).toHaveBeenCalledTimes(1);
        expect(rollbarMock.criticalWithContext).not.toHaveBeenCalled();
    });

    it('lets the user retry when the native stop fails', async () => {
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };
        rootStore.tempDir = 'temp/';
        notificationService.showProgressDialog = vi.fn(() => Promise.resolve());
        notificationService.hideProgressDialog = vi.fn();
        notificationService.showToast = vi.fn();
        modalController.dismiss = vi.fn(() => Promise.resolve());

        const wrapper = await mountRecorder();
        mediaRecorderStopRecordMock.mockImplementationOnce(() => {
            throw new Error('stop boom');
        });

        await expect(wrapper.vm.stop()).rejects.toThrow('stop boom');

        //the saving dialog presented before the native stop must be hidden
        //even on failure, otherwise it sticks over the modal
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('audioRecord stop failed', expect.any(Error));

        //the latch is released: the only control in the modal still works
        await wrapper.vm.stop();
        expect(mediaRecorderStopRecordMock).toHaveBeenCalledTimes(2);
        expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    });

    it('does not repeat a completed stop when release fails', async () => {
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };
        rootStore.tempDir = 'temp/';
        notificationService.showProgressDialog = vi.fn(() => Promise.resolve());
        notificationService.hideProgressDialog = vi.fn();
        notificationService.showToast = vi.fn();
        modalController.dismiss = vi.fn(() => Promise.resolve());

        const wrapper = await mountRecorder();
        mediaRecorderReleaseMock.mockImplementationOnce(() => {
            throw new Error('release boom');
        });

        await expect(wrapper.vm.stop()).rejects.toThrow('release boom');

        //the completed stop is not repeated: only the release is retried
        expect(mediaRecorderStopRecordMock).toHaveBeenCalledTimes(1);
        expect(modalController.dismiss).not.toHaveBeenCalled();

        await wrapper.vm.stop();
        expect(mediaRecorderStopRecordMock).toHaveBeenCalledTimes(1);
        expect(mediaRecorderReleaseMock).toHaveBeenCalledTimes(2);
        expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    });

    it('leaves another operation indicator alone when the saving dialog fails to open', async () => {
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };
        rootStore.tempDir = 'temp/';
        notificationService.showProgressDialog = vi.fn(() => Promise.reject(new Error('show boom')));
        notificationService.hideProgressDialog = vi.fn();
        notificationService.showToast = vi.fn();
        modalController.dismiss = vi.fn(() => Promise.resolve());

        const wrapper = await mountRecorder();

        await expect(wrapper.vm.stop()).rejects.toThrow('show boom');

        //our dialog never opened: hiding would dismiss another operation's indicator
        expect(notificationService.hideProgressDialog).not.toHaveBeenCalled();
        expect(modalController.dismiss).not.toHaveBeenCalled();
    });

    it('retries the exit after a failed recorder dismissal', async () => {
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };
        rootStore.tempDir = 'temp/';
        notificationService.showProgressDialog = vi.fn(() => Promise.resolve());
        notificationService.hideProgressDialog = vi.fn();
        notificationService.showToast = vi.fn();
        //first exit rejects while the modal is still open, retry succeeds
        modalController.dismiss = vi.fn()
            .mockImplementationOnce(() => Promise.reject(new Error('dismiss boom')))
            .mockImplementation(() => Promise.resolve(true));

        const wrapper = await mountRecorder();

        await expect(wrapper.vm.stop()).rejects.toThrow('dismiss boom');

        //Stop is unlatched and completed phases are not repeated: the retry
        //only re-attempts the exit
        await wrapper.vm.stop();
        expect(mediaRecorderStopRecordMock).toHaveBeenCalledTimes(1);
        expect(mediaRecorderReleaseMock).toHaveBeenCalledTimes(1);
        expect(modalController.dismiss).toHaveBeenCalledTimes(2);
    });

    it('leaves Stop usable when the recorder dismissal dismisses nothing', async () => {
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };
        rootStore.tempDir = 'temp/';
        notificationService.showProgressDialog = vi.fn(() => Promise.resolve());
        notificationService.hideProgressDialog = vi.fn();
        notificationService.showToast = vi.fn();
        modalController.dismiss = vi.fn()
            .mockImplementationOnce(() => Promise.resolve(false))
            .mockImplementation(() => Promise.resolve(true));

        const wrapper = await mountRecorder();

        //false means the modal is still open: no throw, Stop stays usable
        await wrapper.vm.stop();
        expect(modalController.dismiss).toHaveBeenCalledTimes(1);

        await wrapper.vm.stop();
        expect(mediaRecorderStopRecordMock).toHaveBeenCalledTimes(1);
        expect(mediaRecorderReleaseMock).toHaveBeenCalledTimes(1);
        expect(modalController.dismiss).toHaveBeenCalledTimes(2);
    });

    it('leaves a replaced dialog alone when stop fails', async () => {
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };
        rootStore.tempDir = 'temp/';
        rootStore.ec5LoadingDialog = null;
        notificationService.showProgressDialog = vi.fn(async () => {
            rootStore.ec5LoadingDialog = 'our-dialog';
        });
        notificationService.hideProgressDialog = vi.fn();
        notificationService.showToast = vi.fn();
        modalController.dismiss = vi.fn(() => Promise.resolve());

        const wrapper = await mountRecorder();
        mediaRecorderStopRecordMock.mockImplementationOnce(() => {
            //another operation replaces the global dialog before we fail
            rootStore.ec5LoadingDialog = 'other-dialog';
            throw new Error('stop boom');
        });

        await expect(wrapper.vm.stop()).rejects.toThrow('stop boom');

        //the dialog is no longer ours: hiding would dismiss theirs
        expect(notificationService.hideProgressDialog).not.toHaveBeenCalled();
    });

    it('reports a native recording failure instead of silently cancelling', async () => {
        const rootStore = useRootStore();
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.ANDROID
        };
        rootStore.tempDir = 'temp/';
        notificationService.showProgressDialog = vi.fn(() => Promise.resolve());
        notificationService.hideProgressDialog = vi.fn();
        notificationService.showToast = vi.fn();
        notificationService.showAlert = vi.fn();
        modalController.dismiss = vi.fn(() => Promise.resolve());

        //capture the error callback the component hands to the native recorder
        const realMedia = window.Media;
        let recordingErrorCallback;
        window.Media = vi.fn((file_URI, successCallback, errorCallback) => {
            recordingErrorCallback = errorCallback;
            return mediaRecorderMock;
        });
        try {
            await mountRecorder();
        } finally {
            window.Media = realMedia;
        }

        recordingErrorCallback({ code: 5 });

        //the dismissal below carries no filename (reads as a cancel), so the
        //native failure must be reported here or it is untraceable
        expect(rollbarMock.criticalWithContext).toHaveBeenCalledWith('audioRecord recording failed', expect.anything());
        expect(notificationService.showAlert).toHaveBeenCalled();
        expect(modalController.dismiss).toHaveBeenCalledWith('');
    });
});
