import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import flushPromises from 'flush-promises';
import {setActivePinia, createPinia} from 'pinia';
import QuestionLocation from '@/components/questions/QuestionLocation.vue';
import LocationNative from '@/components/platform/LocationNative.vue';
import {useRootStore} from '@/stores/root-store';
import {notificationService} from '@/services/notification-service';
import {locationService} from '@/services/utilities/location-cordova-service';
import {PARAMETERS} from '@/config';

vi.mock('@/services/entry/question-common-service', () => {
    const questionCommonService = {
        //fill just the fields the location flow reads; the real service pulls
        //from the project model, which does not exist in unit tests
        setUpInputParams: vi.fn((state) => {
            state.inputDetails = {
                ref: 'test_ref',
                type: 'location',
                is_required: false,
                question: 'Where are you?'
            };
            state.answer.answer = {
                latitude: '',
                longitude: '',
                accuracy: ''
            };
        })
    };
    return {questionCommonService};
});

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(() => Promise.resolve()),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn()
    }
}));

vi.mock('@/services/utilities/location-cordova-service', () => ({
    locationService: {
        getWatchTimeout: vi.fn(() => PARAMETERS.DEFAULT_TIMEOUT)
    }
}));

vi.mock('@/use/questions/popover-location-handler', () => ({
    popoverLocationHandler: vi.fn()
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
    GridQuestionWide: true
};

const ENTRIES = {
    error: {},
    answers: {'test_ref': {answer: {latitude: '', longitude: '', accuracy: ''}, was_jumped: false}},
    confirmAnswer: {'test_ref': {}},
    questionParams: {isBranch: false}
};

const RECOVERED_POSITION = {
    coords: {
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 12.3
    }
};

let getCurrentPositionMock;

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
    getCurrentPositionMock = vi.fn();
    vi.stubGlobal('navigator', {geolocation: {getCurrentPosition: getCurrentPositionMock}});
    //the native diagnostic plugin decides whether acquisition can start
    vi.stubGlobal('cordova', {
        plugins: {
            diagnostic: {
                isLocationAvailable: vi.fn((success) => success(true))
            }
        }
    });
    const rootStore = useRootStore();
    rootStore.language = 'en';
    //drive the native branch of updateLocation: the web one early-returns
    //under VITE_DEBUG, which .env.local sets for the whole test run
    rootStore.device = {platform: 'android'};
    rootStore.geolocationPermission = true;
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

async function factory(entriesAddState = ENTRIES) {
    const wrapper = mount(QuestionLocation, {
        props: {
            inputRef: 'test_ref',
            type: 'location',
            isGroupInput: false
        },
        global: {
            provide: {entriesAddState},
            stubs: ION_STUBS
        }
    });
    await flushPromises();
    return wrapper;
}

//the acquisition flow lives in the native variant; the wrapper only sets up
//the shared question state and dispatches on isPWA
function nativeVm(wrapper) {
    return wrapper.findComponent(LocationNative).vm;
}

//start the acquisition, then make the poll loop see the watch error
async function startWithWatchError(wrapper) {
    await nativeVm(wrapper).updateLocation();
    //the diagnostic callback resolves the dialog before the poll starts
    await flushPromises();
    useRootStore().deviceGeolocation.error = {message: 'watch failed'};
    await vi.advanceTimersByTimeAsync(PARAMETERS.DELAY_MEDIUM + 1);
}

describe('QuestionLocation component', () => {
    it('fills the answer from the getCurrentPosition fallback when the watch errored', async () => {
        const rootStore = useRootStore();
        const wrapper = await factory();

        await startWithWatchError(wrapper);

        //the watch failure hands over to a one-shot getCurrentPosition
        expect(getCurrentPositionMock).toHaveBeenCalledOnce();
        const successCallback = getCurrentPositionMock.mock.calls[0][0];

        successCallback(RECOVERED_POSITION);

        expect(nativeVm(wrapper).state.answer.answer).toEqual({
            latitude: '51.507400',
            longitude: '-0.127800',
            accuracy: 12
        });
        expect(rootStore.isLocationModalActive).toBe(false);
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(notificationService.showAlert).not.toHaveBeenCalled();
    });

    it('reports the failure and clears the dialog when the fallback also errors', async () => {
        const rootStore = useRootStore();
        const wrapper = await factory();

        await startWithWatchError(wrapper);

        const errorCallback = getCurrentPositionMock.mock.calls[0][1];
        errorCallback({message: 'still no lock'});

        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(rootStore.isLocationModalActive).toBe(false);
        expect(notificationService.showAlert).toHaveBeenCalled();
        //the untouched answer keeps the empty answer shape
        expect(nativeVm(wrapper).state.answer.answer).toEqual({
            latitude: '',
            longitude: '',
            accuracy: ''
        });
    });

    it('fills the answer from the polled position when the watch succeeds', async () => {
        const rootStore = useRootStore();
        const wrapper = await factory();

        await nativeVm(wrapper).updateLocation();
        await flushPromises();
        rootStore.deviceGeolocation.position = RECOVERED_POSITION.coords;
        await vi.advanceTimersByTimeAsync(PARAMETERS.DELAY_MEDIUM + 1);

        expect(getCurrentPositionMock).not.toHaveBeenCalled();
        expect(nativeVm(wrapper).state.answer.answer).toEqual({
            latitude: '51.507400',
            longitude: '-0.127800',
            accuracy: 12
        });
        expect(rootStore.isLocationModalActive).toBe(false);
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
    });
});
