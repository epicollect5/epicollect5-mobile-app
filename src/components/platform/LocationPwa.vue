<template>
  <ion-card
      class="question-card"
      :class="{ 'animate__animated animate__fadeIn': !isGroupInput }"
  >
    <ion-card-header class="question-label force-no-padding">
      <ion-card-title>
        <question-label-action
            :disabled="false"
            action="help"
            :questionText="parentState.question"
            @on-label-button-click="openLocationDocs"
        ></question-label-action>
      </ion-card-title>
    </ion-card-header>
    <ion-card-content
        class="ion-text-center"
        :class="{ 'ion-margin': isGroupInput }"
    >
      <ion-item class="lat-long-controls ion-hide-sm-up">
        <ion-input
            label="Lat:"
            label-placement="stacked"
            type="number"
            inputmode="decimal"
            placeholder="###.######"
            :maxlength="PWA_MAX_LATLONG_LENGTH"
            :value="parentState.answer.answer.latitude"
            @ionInput="onLatValueChange($event)"
        ></ion-input>
        <ion-input
            label="Long:"
            label-placement="stacked"
            type="number"
            inputmode="decimal"
            placeholder="###.######"
            :maxlength="PWA_MAX_LATLONG_LENGTH"
            :value="parentState.answer.answer.longitude"
            @ionInput="onLongValueChange($event)"
        ></ion-input>
        <ion-button
            class="ion-text-nowrap"
            size="default"
            color="secondary"
            slot="end"
            :aria-label="labels.update_location"
            :title="labels.update_location"
            @click="updateLocation(true)"
        >
          <ion-icon :icon="locate"></ion-icon>
        </ion-button>
      </ion-item>
      <ion-item class="lat-long-controls ion-hide-sm-down">
        <ion-input
            label="Lat:"
            label-placement="stacked"
            type="number"
            inputmode="decimal"
            placeholder="###.######"
            :maxlength="PWA_MAX_LATLONG_LENGTH"
            :value="parentState.answer.answer.latitude"
            @ionInput="onLatValueChange($event)"
        ></ion-input>
        <ion-input
            label="Long:"
            label-placement="stacked"
            type="number"
            inputmode="decimal"
            placeholder="###.######"
            :maxlength="PWA_MAX_LATLONG_LENGTH"
            :value="parentState.answer.answer.longitude"
            @ionInput="onLongValueChange($event)"
        ></ion-input>
        <ion-button
            class="ion-text-nowrap"
            color="secondary"
            slot="end"
            @click="updateLocation(true)"
        >
          <ion-icon :icon="locate"></ion-icon>
          &nbsp;
          {{ labels.update_location }}
        </ion-button>
      </ion-item>
      <ion-item class="address-controls">
        <ion-input
            :label="labels.address"
            v-model="state.address"
            placeholder="i.e. London"
        ></ion-input>

        <ion-button
            class="ion-hide-sm-down ion-text-nowrap"
            color="secondary"
            slot="end"
            @click="geocodeAddress"
        >
          <ion-icon :icon="search"></ion-icon>
          &nbsp;
          <span>{{ labels.search }}</span>
        </ion-button>
        <ion-button
            class="ion-hide-sm-up ion-text-nowrap"
            color="secondary"
            slot="end"
            size="default"
            :aria-label="labels.search"
            :title="labels.search"
            @click="geocodeAddress"
        >
          <ion-icon :icon="search"></ion-icon>
        </ion-button>
      </ion-item>
      <div
          :id="mapId"
          class="leaflet-map-wrapper"
      >
      </div>
      <div
          class="question-error"
          v-if="hasError"
      >
        {{ errorMessage }}
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script>
import {onMounted, onBeforeUnmount, reactive, computed} from 'vue';
import {STRINGS} from '@/config/strings.js';
import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';
import {useWaitOverlayStore} from '@/stores/wait-overlay-store';
import {search, locate} from 'ionicons/icons';
import markerIcon from '@/leaflet/images/marker-icon@2x.png';
import markerShadow from '@/leaflet/images/marker-shadow.png';
import markerIcon1x from 'leaflet/dist/images/marker-icon.png';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {webService} from '@/services/web-service';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import {FullScreen} from 'leaflet.fullscreen';
import 'leaflet.fullscreen/dist/Control.FullScreen.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default {
  components: {
    QuestionLabelAction
  },
  props: {
    inputRef: {
      type: String,
      required: true
    },
    parentState: {
      type: Object,
      required: true
    },
    isGroupInput: {
      type: Boolean,
      required: true
    }
  },
  setup(props) {
    const rootStore = useRootStore();
    const waitOverlayStore = useWaitOverlayStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const parentState = props.parentState;
    //zoom level when we have a marker set
    const closeUpZoom = 10;
    //wider zoom
    const zoom = 1;
    //veil for the geocode wait overlay: a light dimming, the same WaitOverlay
    //an upload uses heavier
    const GEOCODE_OVERLAY_OPACITY = 0.2;
    let map = null;
    let marker = null;
    //set on unmount: a pending geolocation fix, geocode or init timer must not
    //write state, the map or the wait overlay after the question is gone
    let destroyed = false;
    let initTimeout = null;

    const state = reactive({
      address: ''
    });

    const computedScope = {
      hasError: computed(() => {
        return utilsService.hasQuestionError(parentState);
      }),
      errorMessage: computed(() => {
        if (Object.keys(parentState.error.errors).length > 0) {
          return parentState.error?.errors[parentState.currentInputRef]?.message;
        } else {
          return '';
        }
      })
    };

    const methods = {
      openLocationDocs() {
        window.open(
          'https://docs.epicollect.net/mobile-application/location-questions#web-application',
          '_blank',
          'noopener,noreferrer'
        );
      },
      async geocodeAddress() {
        if (state.address === '') {
          await notificationService.showAlert(labels.no_hits_found);
          return;
        }
        //block the screen and fence the hardware back button for the duration of
        //the request: the geocode is quick, so it uses a lighter veil than an
        //upload. Both the fence and the dialog start INSIDE the try:
        //showProgressDialog can reject (a reload or navigation interrupts its
        //present) and the blocker must never be left set
        try {
          waitOverlayStore.show(GEOCODE_OVERLAY_OPACITY);
          await notificationService.showProgressDialog(
              STRINGS[language].labels.acquiring_position,
              STRINGS[language].labels.wait
          );

          const coords = await webService.geocodeAddressPWA(state.address);

          //the question may have unmounted while the geocode was pending (the
          //screen is blocked above, but a reload is outside its reach): writing
          //the answer or the map marker now targets a gone map, so leave the
          //stale fix out
          if (destroyed) {
            return;
          }

          parentState.answer.answer.latitude = coords.latitude;
          parentState.answer.answer.longitude = coords.longitude;
          parentState.answer.answer.accuracy = coords.accuracy;

          updateMarker(false);
        } catch (error) {
          //handle error
          await notificationService.showAlert(labels.location_fail);
        } finally {
          //release the blocker on every path, or a failed or stale geocode would
          //pin the screen for the rest of the session
          waitOverlayStore.dismiss();
          await notificationService.hideProgressDialog();
        }
      },
      updateLocation(showAlert) {

        //if no location is set, just provide user location
        if (parentState.answer.answer.latitude === '' && parentState.answer.answer.longitude === '') {
          locateUser();
          return;
        }

        //valid coords?
        if (
            utilsService.isValidLatitude(parentState.answer.answer.latitude) &&
            utilsService.isValidLongitude(parentState.answer.answer.longitude)
        ) {
          //update marker position
          updateMarker(showAlert);
        } else {
          //show error
          if (showAlert) {
            notificationService.showAlert(labels.location_fail);
          }
        }
      },
      onLatValueChange(event) {
        const value = event.target.value;
        if (value.length > PARAMETERS.PWA_MAX_LATLONG_LENGTH - 1) {
          parentState.answer.answer.latitude = value.slice(0, PARAMETERS.PWA_MAX_LATLONG_LENGTH);
        } else {
          parentState.answer.answer.latitude = value;
        }
        _syncAccuracyWithCoords();
      },
      onLongValueChange(event) {
        const value = event.target.value;
        if (value.length > PARAMETERS.PWA_MAX_LATLONG_LENGTH - 1) {
          parentState.answer.answer.longitude = value.slice(0, PARAMETERS.PWA_MAX_LATLONG_LENGTH);
        } else {
          parentState.answer.answer.longitude = value;
        }
        _syncAccuracyWithCoords();
      }
    };

    //typed coordinates describe a different point than the last GPS fix, so that
    //fix's accuracy no longer applies: manual coordinates get the default one
    //(locationValidate requires the three fields to be either all set or all
    //empty). Clearing both fields also drops the marker, or the stale pin stays
    //on the map and dragging it would refill the fields the user just cleared
    function _syncAccuracyWithCoords() {
      const answer = parentState.answer.answer;
      const hasBothCoords = answer.latitude !== '' && answer.longitude !== '';
      const hasNoCoords = answer.latitude === '' && answer.longitude === '';

      if (hasNoCoords) {
        answer.accuracy = '';
        if (marker && map) {
          map.removeLayer(marker);
          marker = null;
        }
        return;
      }

      if (hasBothCoords) {
        answer.accuracy = PARAMETERS.GEOLOCATION_DEFAULT_ACCURACY;
      }
    }

    function addMarker(showProgressDialog) {
      //a pending fix can land after unmount, when the map is already gone
      if (!map) {
        return;
      }
      if (showProgressDialog) {
        notificationService.showProgressDialog(
            STRINGS[language].labels.acquiring_position,
            STRINGS[language].labels.wait
        );
      }
      //set icon for marker
      const icon = L.icon({
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        iconSize: [25, 41],
        shadowAnchor: [12, 20] //to center shadow image
      });

      marker = L.marker([parentState.answer.answer.latitude, parentState.answer.answer.longitude], {
        draggable: true,
        icon
      });
      // Update marker on changing its position
      marker.on('dragend', (e) => {
        const coords = e.target.getLatLng();

        parentState.answer.answer.latitude = coords.lat.toFixed(6);
        parentState.answer.answer.longitude = coords.lng.toFixed(6);
        parentState.answer.answer.accuracy = 4; //we drag the marker, assume best accuracy

        map.setView([parentState.answer.answer.latitude, parentState.answer.answer.longitude], map.getZoom());
        console.log('zoom ', map.getZoom());
      });

      //add marker to map
      marker.addTo(map);
      //close up to marker
      map.setView([parentState.answer.answer.latitude, parentState.answer.answer.longitude], closeUpZoom);
      if (showProgressDialog) {
        notificationService.showToast(labels.location_acquired);
        setTimeout(() => {
          if (destroyed) {
            return;
          }
          notificationService.hideProgressDialog();
        }, PARAMETERS.DELAY_MEDIUM);
      }
    }

    function updateMarker(showProgressDialog) {
      if (marker === null) {
        addMarker(showProgressDialog);
        return;
      }
      if (showProgressDialog) {
        notificationService.showProgressDialog(
            STRINGS[language].labels.acquiring_position,
            STRINGS[language].labels.wait
        );
      }
      marker.setLatLng(new L.LatLng(parentState.answer.answer.latitude, parentState.answer.answer.longitude));
      map.setView([parentState.answer.answer.latitude, parentState.answer.answer.longitude], closeUpZoom);
      if (showProgressDialog) {
        notificationService.showToast(labels.location_acquired);
        setTimeout(() => {
          if (destroyed) {
            return;
          }
          notificationService.hideProgressDialog();
        }, PARAMETERS.DELAY_MEDIUM);
      }
    }

    function locateUser() {
      const options = {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: PARAMETERS.DEFAULT_TIMEOUT
      };

      notificationService.showProgressDialog(
          STRINGS[language].labels.acquiring_position,
          STRINGS[language].labels.wait
      );
      if ('geolocation' in navigator) {
        /* geolocation is available */
        navigator.geolocation.getCurrentPosition(
            (position) => {
              //the question may have unmounted while the fix was pending: writing
              //the answer, the marker or the map now targets a removed map
              if (destroyed) {
                notificationService.hideProgressDialog();
                return;
              }
              // Add current location to state
              parentState.answer.answer.longitude = position.coords.longitude.toFixed(6);
              parentState.answer.answer.latitude = position.coords.latitude.toFixed(6);
              parentState.answer.answer.accuracy = Math.round(position.coords.accuracy);
              notificationService.hideProgressDialog();

              //add marker to map
              updateMarker(false);
            },
            (error) => {
              //todo: handle error
              notificationService.showAlert(error.message, STRINGS[language].labels.error);
              notificationService.hideProgressDialog();
            },
            options
        );
      } else {
        notificationService.showAlert(
            STRINGS[language].labels.location_not_available,
            STRINGS[language].labels.error
        );
        notificationService.hideProgressDialog();
      }
    }

    onMounted(async () => {

      // Fix for default marker icons (IMPORTANT)
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon,
        iconUrl: markerIcon1x,
        shadowUrl: markerShadow
      });

      map = L.map(props.inputRef).setView([0, 0], zoom);

      const carto = L.tileLayer(PARAMETERS.CARTO_LIGHT_TILES_PROVIDER, {
        attribution: PARAMETERS.CARTO_TILES_ATTRIBUTION,
        maxNativeZoom: 20
      });

      //ESRI satellite imagery
      const esriSatellite = L.tileLayer(PARAMETERS.ESRI_TILES_PROVIDER_SATELLITE, {
        attribution: PARAMETERS.ESRI_TILES_PROVIDER_ATTRIBUTION,
        maxNativeZoom: 20
      });
      //https://carto.com/basemaps/ (dark style)
      const cartoDark = L.tileLayer(PARAMETERS.CARTO_DARK_TILES_PROVIDER, {
        attribution: PARAMETERS.CARTO_TILES_ATTRIBUTION,
        maxNativeZoom: 20
      });

      //add tiles (OPEN TOPO MAP)
      const opentopo = L.tileLayer(PARAMETERS.OPENTOPO_TILES_PROVIDER, {
        attribution: PARAMETERS.OPENTOPO_TILES_ATTRIBUTION,
        maxNativeZoom: 17
      });

      //add tiles (OSM)
      const osm = L.tileLayer(PARAMETERS.OSM_TILES_PROVIDER, {
        attribution: PARAMETERS.OSM_TILES_ATTRIBUTION,
        maxNativeZoom: 20
      });

      // layers control https://goo.gl/TNMUoJ
      carto.addTo(map); // to set it as the default
      const baseMaps = {
        Satellite: esriSatellite,
        Terrain: opentopo,
        Carto: carto,
        'Carto Dark': cartoDark,
        OpenStreetMap: osm
      };

      //add layers control
      L.control.layers(baseMaps).addTo(map);

      //build locate user control
      L.Control.Locate = L.Control.extend({
        onAdd() {
          //a real button, named for assistive tech: a bare anchor has no button
          //role and is not announced, and Enter/Space activate a button natively,
          //so the click handler below is all it needs
          const btn = L.DomUtil.create('button', 'leaflet-control-locate-me leaflet-bar');
          btn.type = 'button';
          btn.setAttribute('aria-label', labels.update_location);
          btn.title = labels.update_location;

          L.DomEvent.on(btn, 'click', (ev) => {
            L.DomEvent.stopPropagation(ev);
            //locate user
            locateUser();
          });

          return btn;
        },
        onRemove() {
          // Nothing to do here
        }
      });

      //add locate me callback
      L.control.Locate = (opts) => {
        return new L.Control.Locate(opts);
      };

      //add locate me control to map
      L.control.Locate({position: 'topleft'}).addTo(map);

      // Add full screen control to map
      map.addControl(
          new FullScreen({
            position: 'topleft'
          })
      );

      initTimeout = setTimeout(() => {
        //unmounted before the map was laid out
        if (destroyed || !map) {
          return;
        }
        map.invalidateSize();
        if (parentState.answer.answer.latitude !== '' && parentState.answer.answer.longitude !== '') {
          methods.updateLocation(false);
        }
      }, PARAMETERS.DELAY_SHORT);
    });

    onBeforeUnmount(() => {
      destroyed = true;
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      if (map) {
        map.remove();
        map = null;
      }
    });

    return {
      mapId: props.inputRef,
      labels,
      state,
      ...computedScope,
      ...PARAMETERS,
      ...methods,
      //icons
      search,
      locate
    };
  }
};
</script>

<style src="@/theme/components/platform/LocationPwa.scss" lang="scss"></style>
<style src="@/theme/components/platform/LocationPwaCard.scss" lang="scss" scoped></style>
