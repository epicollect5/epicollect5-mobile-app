import {mount} from '@vue/test-utils';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import flushPromises from 'flush-promises';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import LocationPwa from '@/components/LocationPwa.vue';

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
    const L = {
        map: leaflet.mapFn,
        tileLayer: vi.fn(() => ({addTo: vi.fn()})),
        icon: vi.fn(() => ({})),
        marker: leaflet.markerFn,
        LatLng: vi.fn((lat, lng) => ({lat, lng})),
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

vi.mock('@/services/web-service');
vi.mock('@/services/notification-service');

const mountWith = (props = {}) => {
    return mount(LocationPwa, {
        props: {
            inputRef: 'map-id',
            latitude: '',
            longitude: '',
            accuracy: 0,
            ...props
        },
        global: {
            stubs: {
                'ion-item': true,
                'ion-input': true,
                'ion-button': true,
                'ion-icon': true
            }
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

    it('gives manually typed coordinates the default accuracy, not the last GPS fix', async () => {
        const wrapper = mountWith({latitude: '51.500000', longitude: '-0.120000', accuracy: 3});

        wrapper.vm.onLatValueChange({target: {value: '52.200000'}});
        await wrapper.vm.$nextTick();

        //the 3 m fix described the old point: a typed coordinate replaces it
        expect(wrapper.vm.state.accuracy).toBe(PARAMETERS.GEOLOCATION_DEFAULT_ACCURACY);
        wrapper.unmount();
    });

    it('leaves the accuracy alone while only one coordinate is filled', async () => {
        const wrapper = mountWith({latitude: '', longitude: '', accuracy: 3});

        wrapper.vm.onLatValueChange({target: {value: '52.200000'}});
        await wrapper.vm.$nextTick();

        //locationValidate requires all three fields or none: a half-typed pair is
        //not a new point yet, so the accuracy is not repurposed
        expect(wrapper.vm.state.accuracy).toBe(3);
        wrapper.unmount();
    });

    it('drops the marker and the answer when both coordinates are cleared', async () => {
        const wrapper = mountWith({latitude: '51.500000', longitude: '-0.120000', accuracy: 3});

        //place the marker through the same path the Update Location button uses
        wrapper.vm.updateLocation(false);
        await wrapper.vm.$nextTick();
        expect(leaflet.marker.addTo).toHaveBeenCalled();

        wrapper.vm.onLatValueChange({target: {value: ''}});
        wrapper.vm.onLongValueChange({target: {value: ''}});
        await wrapper.vm.$nextTick();

        //a stale pin would stay draggable and its dragend would refill the fields
        expect(leaflet.map.removeLayer).toHaveBeenCalledWith(leaflet.marker);
        expect(wrapper.vm.state.accuracy).toBe('');
        const emitted = wrapper.emitted('on-pwa-location-update');
        expect(emitted.at(-1)[0]).toEqual({latitude: '', longitude: '', accuracy: ''});
        wrapper.unmount();
    });

    it('ignores a geolocation fix that lands after unmount', async () => {
        const getCurrentPosition = vi.fn();
        Object.defineProperty(navigator, 'geolocation', {
            value: {getCurrentPosition},
            configurable: true
        });
        const wrapper = mountWith({latitude: '', longitude: '', accuracy: 0});

        //no coordinates: Update Location asks the device for a fix
        wrapper.vm.updateLocation(true);
        expect(getCurrentPosition).toHaveBeenCalledTimes(1);
        const onSuccess = getCurrentPosition.mock.calls[0][0];

        wrapper.unmount();

        //the question is gone and its map removed: the late fix must not write
        onSuccess({coords: {latitude: 51.5, longitude: -0.12, accuracy: 3}});
        await flushPromises();

        expect(wrapper.vm.state.latitude).toBe('');
        expect(wrapper.vm.state.longitude).toBe('');
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
});
