import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import flushPromises from 'flush-promises';
import {setActivePinia, createPinia} from 'pinia';
import QuestionAudio from '@/components/questions/QuestionAudio.vue';
import ModalAudioPlay from '@/components/modals/ModalAudioPlay.vue';
import ModalAudioRecord from '@/components/modals/ModalAudioRecord.vue';
import {useRootStore} from '@/stores/root-store';
import {modalController} from '@ionic/vue';
import {notificationService} from '@/services/notification-service';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';

//instances created by modalController.create, plus the resolvers of their
//onDidDismiss promises: tests hold the recorder/player open (the double-tap
//window) and release it when the assertion needs the flow to complete
const {modalInstances, modalDismissResolvers} = vi.hoisted(() => ({
    modalInstances: [],
    modalDismissResolvers: []
}));

vi.mock('@/services/entry/question-common-service', () => {
    const questionCommonService = {
        //fill just the fields the component reads; the real service pulls
        //from the project model, which does not exist in unit tests
        setUpInputParams: vi.fn((state) => {
            state.inputDetails = {
                ref: 'test_ref',
                type: 'audio',
                is_required: false,
                question: 'Record a sound',
                regex: null
            };
        })
    };
    return {questionCommonService};
});

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showAlert: vi.fn(),
        showToast: vi.fn(),
        showProgressDialog: vi.fn(() => Promise.resolve()),
        hideProgressDialog: vi.fn()
    }
}));

vi.mock('@/use/questions/popover-media-handler', () => ({
    popoverMediaHandler: vi.fn(async () => {})
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        dismiss: vi.fn(() => Promise.resolve()),
        create: vi.fn(() => {
            const modal = {
                present: vi.fn(() => Promise.resolve()),
                onDidDismiss: vi.fn(() => new Promise((resolve) => {
                    modalDismissResolvers.push(resolve);
                }))
            };
            modalInstances.push(modal);
            return Promise.resolve(modal);
        })
    }
}));

const ION_STUBS = {
    'ion-card': true,
    'ion-card-header': true,
    'ion-card-title': true,
    'ion-card-content': true,
    'ion-grid': true,
    'ion-row': true,
    'ion-col': true,
    'ion-icon': true,
    'ion-button': true,
    QuestionLabelAction: true,
    Dropzone: true
};

const ENTRIES = {
    error: {},
    answers: {'test_ref': {answer: '', was_jumped: false}},
    confirmAnswer: {'test_ref': {}},
    questionParams: {isBranch: false}
};

function makeScope() {
    return {
        entryService: {
            entry: {
                entryUuid: 'entry-uuid-1',
                projectRef: 'proj-ref',
                media: {}
            }
        },
        branchEntryService: {
            entry: {media: {}}
        }
    };
}

//android microphone permission: the native plugin invokes its callback with the
//permission status, granted by default
function mockAndroidPermission(granted = true) {
    const permissionStatus = {GRANTED: 1, DENIED: 0};
    vi.stubGlobal('cordova', {
        plugins: {
            diagnostic: {
                permissionStatus,
                permission: {RECORD_AUDIO: 'RECORD_AUDIO'},
                requestRuntimePermission: vi.fn((success) => {
                    success(granted ? permissionStatus.GRANTED : permissionStatus.DENIED);
                })
            }
        }
    });
}

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    modalInstances.length = 0;
    modalDismissResolvers.length = 0;
    const rootStore = useRootStore();
    rootStore.language = 'en';
    rootStore.device = {platform: PARAMETERS.ANDROID};
    rootStore.isAudioModalActive = false;
    rootStore.entriesAddScope = makeScope();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

async function factory() {
    const wrapper = mount(QuestionAudio, {
        props: {
            inputRef: 'test_ref',
            type: 'audio',
            isGroupInput: false
        },
        global: {
            provide: {entriesAddState: ENTRIES},
            stubs: ION_STUBS
        }
    });
    await flushPromises();
    return wrapper;
}

//the media bucket the component rides on for this entry/input
function mediaFile() {
    return useRootStore().entriesAddScope.entryService.entry.media['entry-uuid-1']['test_ref'];
}

function dismissModal(index, data) {
    modalDismissResolvers[index]({data});
}

describe('QuestionAudio component', () => {

    it('ignores a second record tap while the recorder is open', async () => {
        mockAndroidPermission();
        const wrapper = await factory();

        //the first tap holds the recorder open (its dismissal never resolves yet)
        wrapper.vm.record();
        await flushPromises();
        expect(modalController.create).toHaveBeenCalledTimes(1);
        expect(useRootStore().isAudioModalActive).toBe(true);

        //second tap of the double-tap: inside the debounce window, dropped,
        //never a second recorder
        wrapper.vm.record();
        await flushPromises();
        expect(modalController.create).toHaveBeenCalledTimes(1);

        //play shares the window: no player stacked on an in-flight recorder
        await wrapper.vm.play();
        expect(modalController.create).toHaveBeenCalledTimes(1);

        dismissModal(0, 'audio_1.mp3');
        await flushPromises();
        expect(useRootStore().isAudioModalActive).toBe(false);
    });

    it('keeps the filename once the recorder is dismissed', async () => {
        mockAndroidPermission();
        const wrapper = await factory();

        wrapper.vm.record();
        await flushPromises();
        //present() resolving is not the end of the flow: the recorder is still
        //open, so the overlay gate must still be held
        expect(useRootStore().isAudioModalActive).toBe(true);

        dismissModal(0, 'audio_1.mp3');
        await flushPromises();

        expect(useRootStore().isAudioModalActive).toBe(false);
        expect(mediaFile().cached).toBe('audio_1.mp3');
        expect(wrapper.vm.state.answer.answer).toBe('audio_1.mp3');
    });

    it('leaves the answer untouched when the recorder dismisses with no filename', async () => {
        mockAndroidPermission();
        const wrapper = await factory();

        //seed a previous recording: a cancel must preserve it, not clear it
        mediaFile().cached = 'old.mp3';
        wrapper.vm.state.answer.answer = 'old.mp3';

        wrapper.vm.record();
        await flushPromises();

        dismissModal(0, undefined);
        await flushPromises();

        //no recording was handed over: the entry must not point at a missing file
        expect(mediaFile().cached).toBe('old.mp3');
        expect(wrapper.vm.state.answer.answer).toBe('old.mp3');
    });

    it('releases the gate and alerts when the recorder cannot be presented', async () => {
        mockAndroidPermission();
        modalController.create.mockImplementationOnce(() => Promise.resolve({
            present: vi.fn(() => Promise.reject(new Error('present boom'))),
            onDidDismiss: vi.fn(() => new Promise(() => {
            }))
        }));
        const wrapper = await factory();

        wrapper.vm.record();
        await flushPromises();
        await flushPromises();

        //a stranded gate would swallow the EntriesAdd hardware back button for
        //the rest of the session
        expect(useRootStore().isAudioModalActive).toBe(false);
        expect(notificationService.showAlert).toHaveBeenCalledWith('present boom');
    });

    it('does not open the recorder when the microphone permission is denied', async () => {
        mockAndroidPermission(false);
        const wrapper = await factory();

        wrapper.vm.record();
        await flushPromises();

        expect(modalController.create).not.toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith(
            STRINGS.en.labels.missing_permission
        );
        expect(useRootStore().isAudioModalActive).toBe(false);
    });

    it('ignores a second play tap while the player is open', async () => {
        const wrapper = await factory();

        const firstPlay = wrapper.vm.play();
        await flushPromises();
        expect(modalController.create).toHaveBeenCalledTimes(1);
        expect(modalController.create).toHaveBeenCalledWith(expect.objectContaining({
            component: ModalAudioPlay
        }));

        await wrapper.vm.play();
        expect(modalController.create).toHaveBeenCalledTimes(1);

        dismissModal(0);
        await firstPlay;
        expect(useRootStore().isAudioModalActive).toBe(false);
    });

    it('releases the gate and alerts when the player cannot be presented', async () => {
        modalController.create.mockImplementationOnce(() => Promise.resolve({
            present: vi.fn(() => Promise.reject(new Error('play present boom'))),
            onDidDismiss: vi.fn(() => new Promise(() => {
            }))
        }));
        const wrapper = await factory();

        await wrapper.vm.play();

        expect(useRootStore().isAudioModalActive).toBe(false);
        expect(notificationService.showAlert).toHaveBeenCalledWith('play present boom');
    });

    it('opens the recorder modal for the audio question', async () => {
        mockAndroidPermission();
        const wrapper = await factory();

        wrapper.vm.record();
        await flushPromises();

        expect(modalController.create).toHaveBeenCalledWith(expect.objectContaining({
            component: ModalAudioRecord,
            cssClass: 'modal-audio-record'
        }));

        dismissModal(0, 'audio_1.mp3');
        await flushPromises();
    });

    it('keeps the navigation gate free while the permission prompt is pending', async () => {
        //the shape this repo has already hit with the camera plugin: the native
        //plugin takes the call and never invokes either callback
        vi.stubGlobal('cordova', {
            plugins: {
                diagnostic: {
                    permission: {RECORD_AUDIO: 'RECORD_AUDIO'},
                    requestRuntimePermission: vi.fn()
                }
            }
        });
        const wrapper = await factory();

        wrapper.vm.record();
        await flushPromises();

        //no latch strands and the flag the EntriesAdd back handler reads
        //is never claimed before an overlay is actually presented: a hung
        //callback strands nothing, navigation keeps working
        expect(modalController.create).not.toHaveBeenCalled();
        expect(useRootStore().isAudioModalActive).toBe(false);

        //a later tap lands inside the debounce window and is dropped
        //(past the window it simply re-asks, same as the first tap)
        wrapper.vm.record();
        expect(modalController.create).not.toHaveBeenCalled();
    });

    it('drops a record tap racing an open player past the debounce window', async () => {
        mockAndroidPermission();
        const wrapper = await factory();

        const firstPlay = wrapper.vm.play();
        await flushPromises();
        expect(useRootStore().isAudioModalActive).toBe(true);

        //slow second tap: past the debounce window, but the read-only
        //overlay check still drops it, never a recorder over the player
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + PARAMETERS.DELAY_LONG + 1);
        try {
            wrapper.vm.record();
            await flushPromises();
        } finally {
            nowSpy.mockRestore();
        }
        expect(modalController.create).toHaveBeenCalledTimes(1);

        dismissModal(0);
        await firstPlay;
        expect(useRootStore().isAudioModalActive).toBe(false);
    });

    it('drops a record tap from another instance while the recorder is open', async () => {
        mockAndroidPermission();
        const first = await factory();
        const second = await factory();

        first.vm.record();
        await flushPromises();
        expect(modalController.create).toHaveBeenCalledTimes(1);

        //past the debounce window, so only the shared pending guard can drop it
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + PARAMETERS.DELAY_LONG + 1);
        try {
            second.vm.record();
            await flushPromises();
        } finally {
            nowSpy.mockRestore();
        }
        expect(modalController.create).toHaveBeenCalledTimes(1);

        dismissModal(0, 'audio_1.mp3');
        await flushPromises();
    });
});
