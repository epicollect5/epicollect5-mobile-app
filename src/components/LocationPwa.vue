<template>
	<div>
		<ion-item class="lat-long-controls ion-hide-sm-up">
			<ion-input
				label="Lat:"
				label-placement="stacked"
				type="number"
				inputmode="decimal"
				placeholder="###.######"
				:maxlength="PWA_MAX_LATLONG_LENGTH"
				:value="state.latitude"
				@keyup="onLatValueChange($event)"
			></ion-input>
			<ion-input
				label="Long:"
				label-placement="stacked"
				type="number"
				inputmode="decimal"
				placeholder="###.######"
				:maxlength="PWA_MAX_LATLONG_LENGTH"
				:value="state.longitude"
				@keyup="onLongValueChange($event)"
			></ion-input>
			<ion-button
				class="ion-text-nowrap"
				size="default"
				color="secondary"
				slot="end"
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
				:value="state.latitude"
				@keyup="onLatValueChange($event)"
			></ion-input>
			<ion-input
				label="Long:"
				label-placement="stacked"
				type="number"
				inputmode="decimal"
				placeholder="###.######"
				:maxlength="PWA_MAX_LATLONG_LENGTH"
				:value="state.longitude"
				@keyup="onLongValueChange($event)"
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
				@click="geocodeAddress"
			>
				<ion-icon :icon="search"></ion-icon>
			</ion-button>
		</ion-item>
	</div>
	<div
		:id="mapId"
		class="leaflet-map-wrapper"
	>
	</div>
</template>

<script>
import { onMounted, onBeforeMount, onBeforeUnmount } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { search, locate } from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import markerIcon from '@/leaflet/images/marker-icon@2x.png';
import markerShadow from '@/leaflet/images/marker-shadow.png';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { webService } from '@/services/web-service';

export default {
	props: {
		inputRef: {
			type: String,
			required: true
		},
		latitude: {
			type: String,
			required: true
		},
		longitude: {
			type: String,
			required: true
		},
		accuracy: {
			type: Number,
			required: true
		}
	},
	emits: ['on-pwa-location-update'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		//zoom level when we have a marker set
		const closeUpZoom = 10;
		//wider zoom
		const zoom = 1;
		let map = null;
		let marker = null;
		let L = null;

		const state = reactive({
			latitude: props.latitude,
			longitude: props.longitude,
			accuracy: props.accuracy,
			address: ''
		});

		const methods = {
			async geocodeAddress() {
				if (state.address === '') {
					notificationService.showAlert(labels.no_hits_found);
					return;
				}
				notificationService.showProgressDialog(
					STRINGS[language].labels.acquiring_position,
					STRINGS[language].labels.wait
				);

				try {
					const coords = await webService.geocodeAddressPWA(state.address);

					state.latitude = coords.latitude;
					state.longitude = coords.longitude;
					state.accuracy = coords.accuracy;

					updateMarker(false);
				} catch (error) {
					//handle error
					notificationService.showAlert(labels.location_fail);
				} finally {
					notificationService.hideProgressDialog();
				}
			},
			updateLocation(showAlert) {
				console.log({ lat: state.latitude, long: state.longitude });

				//if no location is set, just provide user location
				if (state.latitude === '' && state.longitude === '') {
					locateUser();
					return;
				}

				//valid coords?
				if (
					utilsService.isValidLatitude(state.latitude) &&
					utilsService.isValidLongitude(state.longitude)
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
					state.latitude = value.slice(0, PARAMETERS.PWA_MAX_LATLONG_LENGTH);
				} else {
					state.latitude = value;
				}
			},
			onLongValueChange(event) {
				const value = event.target.value;
				if (value.length > PARAMETERS.PWA_MAX_LATLONG_LENGTH - 1) {
					state.longitude = value.slice(0, PARAMETERS.PWA_MAX_LATLONG_LENGTH);
				} else {
					state.longitude = value;
				}
			}
		};

		function addMarker(showProgressDialog) {
			if (showProgressDialog) {
				notificationService.showProgressDialog(
					STRINGS[language].labels.acquiring_position,
					STRINGS[language].labels.wait
				);
			}
			//set icon for marker
			L.Marker.prototype.setIcon(
				L.icon({
					iconUrl: markerIcon,
					shadowUrl: markerShadow,
					iconSize: [25, 41],
					shadowAnchor: [12, 20] //to center shadow image
				})
			);

			marker = L.marker([state.latitude, state.longitude], {
				draggable: true
			});
			// Update marker on changing its position
			marker.on('dragend', (e) => {
				const coords = e.target._latlng;

				state.latitude = coords.lat.toFixed(6);
				state.longitude = coords.lng.toFixed(6);
				state.accuracy = 4; //we drag the marker, assume best accuracy

				map.setView([state.latitude, state.longitude], map.getZoom());
				console.log('zoom ', map.getZoom());
				emitPWALocationUpdate();
			});

			//add marker to map
			marker.addTo(map);
			//close up to marker
			map.setView([state.latitude, state.longitude], closeUpZoom);
			if (showProgressDialog) {
				notificationService.showToast(labels.location_acquired);
			}
			emitPWALocationUpdate();
			setTimeout(() => {
				notificationService.hideProgressDialog();
			}, PARAMETERS.DELAY_MEDIUM);
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
			marker.setLatLng(new L.LatLng(state.latitude, state.longitude));
			map.setView([state.latitude, state.longitude], closeUpZoom);
			if (showProgressDialog) {
				notificationService.showToast(labels.location_acquired);
			}
			emitPWALocationUpdate();
			setTimeout(() => {
				notificationService.hideProgressDialog();
			}, PARAMETERS.DELAY_MEDIUM);
		}

		function emitPWALocationUpdate() {
			context.emit('on-pwa-location-update', {
				latitude: state.latitude,
				longitude: state.longitude,
				accuracy: state.accuracy
			});
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
						// Add current location to state
						state.longitude = position.coords.longitude.toFixed(6);
						state.latitude = position.coords.latitude.toFixed(6);
						state.accuracy = Math.round(position.coords.accuracy);
						notificationService.hideProgressDialog();
						console.log(state.longitude, state.latitude, state.accuracy);

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

		onBeforeMount(() => {
			//load leaflet from CDN

			if (!window.L) {
				//
			}
		});

		onMounted(async () => {
			L = window.L;

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
			//http://maps.stamen.com/#watercolor/12/37.7706/-122.3782
			const stamenHC = L.tileLayer(PARAMETERS.STAMEN_HIGH_CONTRAST_TILES_PROVIDER, {
				attribution: PARAMETERS.STAMEN_TILES_ATTRIBUTION,
				maxNativeZoom: 20
			});

			//add tiles (MAPBOX OUTDOOR)
			const mapboxOutdoors = L.tileLayer(PARAMETERS.MAPBOX_TILES_PROVIDER_OUTDOOR, {
				attribution: PARAMETERS.MAPBOX_TILES_ATTRIBUTION,
				maxNativeZoom: 20
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
				Terrain: mapboxOutdoors,
				Contrast: stamenHC,
				Carto: carto,
				OpenStreetMap: osm
			};

			//add layers control
			L.control.layers(baseMaps).addTo(map);

			//add full screen control
			L.control.fullscreen({ position: 'topleft' }).addTo(map);

			//build locate user control
			L.Control.Locate = L.Control.extend({
				onAdd() {
					const btn = L.DomUtil.create('a', 'leaflet-control-locate-me leaflet-bar');

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
			L.control.Locate({ position: 'topleft' }).addTo(map);

			setTimeout(() => {
				map.invalidateSize();
				if (state.latitude !== '' && state.longitude !== '') {
					methods.updateLocation(false);
				}
			}, 100);
		});

		onBeforeUnmount(() => {
			if (map) {
				map.remove();
			}
		});

		return {
			mapId: props.inputRef,
			labels,
			state,
			...PARAMETERS,
			...methods,
			//icons
			search,
			locate
		};
	}
};
</script>

<style lang="scss"></style>