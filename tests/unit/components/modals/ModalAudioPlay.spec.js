import ModalAudioPlay from '@/components/modals/ModalAudioPlay.vue';
import { mount, shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { createTestingPinia } from '@pinia/testing';
import { notificationService } from '@/services/notification-service';
import { webService } from '@/services/web-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { useDBStore } from '@/stores/db-store';
import flushPromises from 'flush-promises';
import { modalController, loadingController } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';


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

describe('ModalAudioPlay component', () => {

    it('should be in default language', async () => {

        const rootStore = useRootStore;
        rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
        rootStore.device = {
            platform: PARAMETERS.WEB
        };

        expect(rootStore.language).toBe(PARAMETERS.DEFAULT_LANGUAGE);
        expect(STRINGS[rootStore.language].labels.playing_audio).toBe('Playing audio...');


        const wrapper = shallowMount(ModalAudioPlay, {
            props: {
                projectRef,
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

            const wrapper = shallowMount(ModalAudioPlay, {
                props: {
                    projectRef,
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

    //imp: cannot make this work as thre is not interaction on the warpper
    it('should play media file', async () => {

        // Create a mock mediaPlayer object with a play method
        const playMock = vi.fn().mockReturnValue(true);
        const stopMock = vi.fn().mockReturnValue(true);
        const releaseMock = vi.fn().mockReturnValue(true);
        const mockMediaPlayer = {
            play: playMock,
            stop: stopMock,
            release: releaseMock
        };
        const rootStore = useRootStore();
        rootStore.device = {
            platform: PARAMETERS.WEB
        };

        const _onPlayStatusChangeMock = vi.fn((status) => {
            console.log('Mock _onPlayStatusChange called with status:', status);
            // Close the modal and release media object
            if (status === 4) {
                mockMediaPlayer.release();
                modalController.dismiss();
            }
        });

        //imp: mock before mounting as it gets called in setup();
        notificationService.showProgressDialog = vi.fn().mockReturnValue(true);
        Capacitor.isNativePlatform.mockReturnValue(true);
        modalController.dismiss = vi.fn().mockReturnValue(true);

        window.Media = vi.fn((file_URI, success, error, _onPlayStatusChange) => {
            _onPlayStatusChangeMock.mockImplementation((status) => {
                // Call _onPlayStatusChangeMock with the provided status value
                _onPlayStatusChange(status);
            });
            return mockMediaPlayer;
        });

        // Mount the component and provide the mock window.Media constructor
        const wrapper = shallowMount(ModalAudioPlay, {
            props: {
                projectRef,
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

        expect(Capacitor.isNativePlatform).toReturn(true);
        await flushPromises();
        expect(playMock).toHaveBeenCalledOnce();

        //Media.MEDIA_STARTING = 1;
        let statusValue = 1;
        // Call the _onPlayStatusChangeMock with the status value
        _onPlayStatusChangeMock(statusValue);
        expect(_onPlayStatusChangeMock).toHaveBeenCalled();
        expect(releaseMock).not.toHaveBeenCalledOnce();
        expect(modalController.dismiss).not.toHaveBeenCalledOnce();

        //Media.MEDIA_RUNNING = 2;
        statusValue = 2;
        // Call the _onPlayStatusChangeMock with the status value
        _onPlayStatusChangeMock(statusValue);
        expect(_onPlayStatusChangeMock).toHaveBeenCalled();
        expect(releaseMock).not.toHaveBeenCalledOnce();
        expect(modalController.dismiss).not.toHaveBeenCalledOnce();

        //Media.MEDIA_STOPPED = 4;
        statusValue = 4;//end of audio file
        // Call the _onPlayStatusChangeMock with the status value
        _onPlayStatusChangeMock(statusValue);
        expect(_onPlayStatusChangeMock).toHaveBeenCalled();
        expect(releaseMock).toHaveBeenCalledOnce();
        expect(modalController.dismiss).toHaveBeenCalledOnce();
    });

    it('should stop playback', async () => {

        // Create a mock mediaPlayer object with a play method
        const playMock = vi.fn().mockReturnValue(true);
        const stopMock = vi.fn().mockReturnValue(true);
        const releaseMock = vi.fn().mockReturnValue(true);
        const mockMediaPlayer = {
            play: playMock,
            stop: stopMock,
            release: releaseMock
        };

        const _onPlayStatusChangeMock = vi.fn((status) => {
            console.log('Mock _onPlayStatusChange called with status:', status);
            // Close the modal and release media object
            if (status === 4) {
                mockMediaPlayer.release();
                modalController.dismiss();
            }
        });

        const rootStore = useRootStore();
        rootStore.device = {
            platform: PARAMETERS.WEB
        };

        //imp: mock before mounting as it gets called in setup();
        Capacitor.isNativePlatform.mockReturnValue(true);
        modalController.dismiss = vi.fn().mockReturnValue(true);

        window.Media = vi.fn((file_URI, success, error, _onPlayStatusChange) => {
            _onPlayStatusChangeMock.mockImplementation((status) => {
                // Call _onPlayStatusChangeMock with the provided status value
                _onPlayStatusChange(status);
            });
            return mockMediaPlayer;
        });

        // Mount the component and provide the mock window.Media constructor
        const wrapper = shallowMount(ModalAudioPlay, {
            props: {
                projectRef,
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

        expect(Capacitor.isNativePlatform).toReturn(true);
        await flushPromises();
        expect(playMock).toHaveBeenCalledOnce();

        wrapper.find('[data-test="stop"]').trigger('click');
        expect(stopMock).toHaveBeenCalledOnce();
    });
});