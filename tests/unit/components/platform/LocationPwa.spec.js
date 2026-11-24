import {mount} from '@vue/test-utils';
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import flushPromises from 'flush-promises';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {useWaitOverlayStore} from '@/stores/wait-overlay-store';
import {webService} from '@/services/web-service';
import LocationPwa from '@/components/platform/LocationPwa.vue';

//leaflet draws into a real DOM node and needs a layout engine: everything the
//component touches is stubbed, so the assertions stay on our own logic
const leaflet = vi.hoisted(() => {
    const map = {
        setView: vi.fn().mockReturnThis(),
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        invalidateSize: vi.fn(),
        remove: vi.fn(),
        addControl: vi.fn(),
        getZoom: vi.fn(() => 5)
    };
    const marker = {
        addTo: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        setLatLng: vi.fn()
    };
    return {
        map,
        marker,
        mapFn: vi.fn(() => map),
        markerFn: vi.fn(() => marker),
        extend: vi.fn((definition) => {
            function Control(options) {
                this.options = options;
                this.definition = definition;
                this.addTo = vi.fn().mockReturnThis();
            }

            return Control;
        })
    };
});

vi.mock('leaflet', () => {
    //a real constructor: a geocode updates an existing marker, and L.marker's
    //setLatLng path builds one with `new`
    class LatLng {
        constructor(lat, lng) {
            this.lat = lat;
            this.lng = lng;
        }
    }

    const L = {
        map: leaflet.mapFn,
        tileLayer: vi.fn(() => ({addTo: vi.fn()})),
        icon: vi.fn(() => ({})),
        marker: leaflet.markerFn,
        LatLng,
        Control: {extend: leaflet.extend},
        control: {layers: vi.fn(() => ({addTo: vi.fn()}))},
        DomUtil: {
            create: vi.fn(() => ({
                setAttribute: vi.fn()
            }))
        },
        DomEvent: {on: vi.fn(), stopPropagation: vi.fn()},
        Icon: {Default: {prototype: {}, mergeOptions: vi.fn()}}
    };
    return {default: L};
});

vi.mock('leaflet.fullscreen', () => ({
    FullScreen: class FullScreen {
        constructor(options) {
            this.options = options;
        }
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(() => Promise.resolve()),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn()
    }
}));

//geocoding is the one web call this component makes: the resolved coordinates
//are asserted against
vi.mock('@/services/web-service', () => ({
    webService: {
        geocodeAddressPWA: vi.fn()
    }
}));

//only the label action is stubbed: the ion-* tags render as plain custom
//elements, so the aria-label assertions can read their attributes
const STUBS = {
    QuestionLabelAction: true
};

const mountWith = ({latitude = '', longitude = '', accuracy = ''} = {}) => {
    return mount(LocationPwa, {
        props: {
            inputRef: 'map-id',
            isGroupInput: false,
            parentState: {
                question: 'Where are you?',
                currentInputRef: 'test_ref',
                error: {errors: {}},
                answer: {answer: {latitude, longitude, accuracy}}
            }
        },
        global: {
            stubs: STUBS
        }
    });
};

describe('LocationPwa', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        const rootStore = useRootStore();
        rootStore.language = 'en';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('gives manually typed coordinates the default accuracy, not the last GPS fix', async () => {
        const wrapper = mountWith({latitude: '51.500000', longitude: '-0.120000', accuracy: 3});

        wrapper.vm.onLatValueChange({target: {value: '52.200000'}});
        await wrapper.vm.$nextTick();

        //the 3 m fix described the old point: a typed coordinate replaces it
        expect(wrapper.vm.parentState.answer.answer.accuracy).toBe(PARAMETERS.GEOLOCATION_DEFAULT_ACCURACY);
        wrapper.unmount();
    });

    it('leaves the accuracy alone while only one coordinate is filled', async () => {
        const wrapper = mountWith({latitude: '', longitude: '', accuracy: 3});

        wrapper.vm.onLatValueChange({target: {value: '52.200000'}});
        await wrapper.vm.$nextTick();

        //locationValidate requires all three fields or none: a half-typed pair is
        //not a new point yet, so the accuracy is not repurposed
        expect(wrapper.vm.parentState.answer.answer.accuracy).toBe(3);
        wrapper.unmount();
    });

    it('drops the marker and the answer when both coordinates are cleared', async () => {
        const wrapper = mountWith({latitude: '51.500000', longitude: '-0.120000', accuracy: 3});

        //place the marker through the same path the Update Location button uses
        wrapper.vm.updateLocation(false);
        await wrapper.vm.$nextTick();
        expect(leaflet.markerFn).toHaveBeenCalled();

        wrapper.vm.onLatValueChange({target: {value: ''}});
        wrapper.vm.onLongValueChange({target: {value: ''}});
        await wrapper.vm.$nextTick();

        //a stale pin would stay draggable and its dragend would refill the fields
        expect(leaflet.map.removeLayer).toHaveBeenCalledWith(leaflet.marker);
        expect(wrapper.vm.parentState.answer.answer).toEqual({latitude: '', longitude: '', accuracy: ''});
        wrapper.unmount();
    });

    it('ignores a geolocation fix that lands after unmount', async () => {
        const getCurrentPosition = vi.fn();
        vi.stubGlobal('navigator', {geolocation: {getCurrentPosition}});
        const wrapper = mountWith({latitude: '', longitude: '', accuracy: 0});

        //no coordinates: Update Location asks the device for a fix
        wrapper.vm.updateLocation(true);
        expect(getCurrentPosition).toHaveBeenCalledTimes(1);
        const onSuccess = getCurrentPosition.mock.calls[0][0];

        wrapper.unmount();

        //the question is gone and its map removed: the late fix must not write
        onSuccess({coords: {latitude: 51.5, longitude: -0.12, accuracy: 3}});
        await flushPromises();

        expect(wrapper.vm.parentState.answer.answer).toEqual({latitude: '', longitude: '', accuracy: 0});
        expect(leaflet.markerFn).not.toHaveBeenCalled();
    });

    it('names the icon-only controls for assistive tech', () => {
        const wrapper = mountWith();
        const labels = wrapper.findAll('ion-button').map((button) => button.attributes('aria-label'));

        //the small-breakpoint Update Location and Search buttons show an icon only,
        //so they carry the same names as their text counterparts
        expect(labels).toContain(STRINGS.en.labels.update_location);
        expect(labels).toContain(STRINGS.en.labels.search);
        wrapper.unmount();
    });

    it('fences navigation while the geocode is pending and releases it once the answer lands', async () => {
        let resolveGeocode;
        webService.geocodeAddressPWA.mockReturnValue(new Promise((resolve) => {
            resolveGeocode = resolve;
        }));
        const waitOverlayStore = useWaitOverlayStore();
        const wrapper = mountWith();
        wrapper.vm.state.address = 'London';

        wrapper.vm.geocodeAddress();
        await wrapper.vm.$nextTick();

        //the blocker is up (visible overlay + back-button fence) for the whole
        //request, at the light geocode opacity, so the question cannot be
        //unmounted mid geocode
        expect(waitOverlayStore.isBlocking).toBe(true);
        expect(waitOverlayStore.overlayOpacity).toBe(0.2);

        resolveGeocode({latitude: '51.500000', longitude: '-0.120000', accuracy: PARAMETERS.GEOLOCATION_DEFAULT_ACCURACY});
        await flushPromises();

        expect(wrapper.vm.parentState.answer.answer).toEqual({
            latitude: '51.500000',
            longitude: '-0.120000',
            accuracy: PARAMETERS.GEOLOCATION_DEFAULT_ACCURACY
        });
        expect(waitOverlayStore.isBlocking).toBe(false);
        wrapper.unmount();
    });

    it('releases the guard even when the progress dialog fails to present', async () => {
        //a reload or navigation can interrupt the dialog's present, which rejects:
        //the guard must never be left set, or the app-wide overlay/back fence
        //sticks for the rest of the session
        const {notificationService} = await import('@/services/notification-service');
        notificationService.showProgressDialog.mockRejectedValueOnce(new Error('dialog interrupted'));
        const waitOverlayStore = useWaitOverlayStore();
        const wrapper = mountWith();
        wrapper.vm.state.address = 'London';

        await wrapper.vm.geocodeAddress();
        await flushPromises();

        expect(waitOverlayStore.isBlocking).toBe(false);
        wrapper.unmount();
    });

    it('does not write coordinates or leave the guard up when a geocode lands after unmount', async () => {
        let resolveGeocode;
        webService.geocodeAddressPWA.mockReturnValue(new Promise((resolve) => {
            resolveGeocode = resolve;
        }));
        const waitOverlayStore = useWaitOverlayStore();
        const wrapper = mountWith({latitude: '', longitude: '', accuracy: 0});
        wrapper.vm.state.address = 'London';

        wrapper.vm.geocodeAddress();
        await wrapper.vm.$nextTick();
        expect(waitOverlayStore.isBlocking).toBe(true);

        //a reload is outside the guard's reach: the question is gone before the
        //response arrives
        wrapper.unmount();

        resolveGeocode({latitude: '51.500000', longitude: '-0.120000', accuracy: 3});
        await flushPromises();

        //the late response must not resurrect the answer, and the shared guard must not pin
        expect(wrapper.vm.parentState.answer.answer).toEqual({latitude: '', longitude: '', accuracy: 0});
        expect(waitOverlayStore.isBlocking).toBe(false);
    });
});
