<template>
	<div>
		<ion-item class="lat-long-controls ion-hide-sm-up">
			<ion-label position="stacked">Lat:</ion-label>
			<ion-input
				type="number"
				inputmode="decimal"
				placeholder="###.######"
				:maxlength="PWA_MAX_LATLONG_LENGTH"
				:value="state.latitude"
				@keyup="onLatValueChange($event)"
			></ion-input>
			<ion-label position="stacked">Long:</ion-label>
			<ion-input
				type="number"
				inputmode="decimal"
				placeholder="###.######"
				:maxlength="PWA_MAX_LATLONG_LENGTH"
				:value="state.longitude"
				@keyup="onLongValueChange($event)"
			></ion-input>
			<ion-button
				size="default"
				color="secondary"
				slot="end"
			>
				<ion-icon :icon="locate"></ion-icon>
			</ion-button>
		</ion-item>
		<ion-item class="lat-long-controls ion-hide-sm-down">
			<ion-label>Lat:</ion-label>
			<ion-input
				type="number"
				inputmode="decimal"
				placeholder="###.######"
				:maxlength="PWA_MAX_LATLONG_LENGTH"
				:value="state.latitude"
				@keyup="onLatValueChange($event)"
			></ion-input>
			<ion-label>Long:</ion-label>
			<ion-input
				type="number"
				inputmode="decimal"
				placeholder="###.######"
				:maxlength="PWA_MAX_LATLONG_LENGTH"
				:value="state.longitude"
				@keyup="onLongValueChange($event)"
			></ion-input>
			<ion-button
				color="secondary"
				slot="end"
				@click="updateLocation(true)"
			>
				<ion-icon :icon="locate"></ion-icon>
				&nbsp;
				{{labels.update_location}}
			</ion-button>
		</ion-item>
		<ion-item class="address-controls">
			<ion-label>{{labels.address}}</ion-label>
			<ion-input
				v-model="state.address"
				placeholder="i.e. London"
			></ion-input>

			<ion-button
				class="ion-hide-sm-down"
				color="secondary"
				slot="end"
				@click="geocodeAddress"
			>
				<ion-icon :icon="search"></ion-icon>
				&nbsp;
				<span>{{labels.search}}</span>
			</ion-button>
			<ion-button
				class="ion-hide-sm-up"
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
import { onMounted, onBeforeUnmount } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import * as services from '@/services';
import * as icons from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import 'leaflet.fullscreen';
import L from 'leaflet';
import markerIcon from '@/leaflet/images/marker-icon@2x.png';
import markerShadow from '@/leaflet/images/marker-shadow.png';

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

		const state = reactive({
			latitude: props.latitude,
			longitude: props.longitude,
			accuracy: props.accuracy,
			address: ''
		});

		const methods = {
			async geocodeAddress() {
				if (state.address === '') {
					services.notificationService.showAlert(labels.no_hits_found);
					return;
				}
				services.notificationService.showProgressDialog(
					STRINGS[language].labels.acquiring_position,
					STRINGS[language].labels.wait
				);

				try {
					const coords = await services.webService.geocodeAddressPWA(state.address);

					state.latitude = coords.latitude;
					state.longitude = coords.longitude;
					state.accuracy = coords.accuracy;

					updateMarker(false);
				} catch (error) {
					//handle error
					services.notificationService.showAlert(labels.location_fail);
				} finally {
					services.notificationService.hideProgressDialog();
				}
			},
			updateLocation(showAlert) {
				console.log({ lat: state.latitude, long: state.longitude });

				//if no location is set, just provide user location
				if (state.latitude === '' && state.longitude === '') {
					locateUser();
					return;
				}

				if (services.utilsService.isValidLatitude(state.latitude)) {
					if (services.utilsService.isValidLongitude(state.longitude)) {
						//update marker position
						updateMarker(showAlert);
					} else {
						if (showAlert) {
							services.notificationService.showAlert(labels.location_fail);
						}
					}
				} else {
					if (showAlert) {
						services.notificationService.showAlert(labels.location_fail);
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
				services.notificationService.showProgressDialog(
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
			});

			//add marker to map
			marker.addTo(map);
			//close up to marker
			map.setView([state.latitude, state.longitude], closeUpZoom);
			if (showProgressDialog) {
				services.notificationService.showToast(labels.location_acquired);
			}
			emitPWALocationUpdate();
			setTimeout(() => {
				services.notificationService.hideProgressDialog();
			}, PARAMETERS.DELAY_MEDIUM);
		}

		function updateMarker(showProgressDialog) {
			if (marker === null) {
				addMarker(showProgressDialog);
				return;
			}
			if (showProgressDialog) {
				services.notificationService.showProgressDialog(
					STRINGS[language].labels.acquiring_position,
					STRINGS[language].labels.wait
				);
			}
			marker.setLatLng(new L.LatLng(state.latitude, state.longitude));
			map.setView([state.latitude, state.longitude], closeUpZoom);
			if (showProgressDialog) {
				services.notificationService.showToast(labels.location_acquired);
			}
			emitPWALocationUpdate();
			setTimeout(() => {
				services.notificationService.hideProgressDialog();
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
				timeout: PARAMETERS.GEOLOCATION_TIMEOUT
			};

			services.notificationService.showProgressDialog(
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
						services.notificationService.hideProgressDialog();
						console.log(state.longitude, state.latitude, state.accuracy);

						//add marker to map
						updateMarker(false);
					},
					(error) => {
						//todo: handle error
						services.notificationService.showAlert(error, STRINGS[language].labels.error);
						services.notificationService.hideProgressDialog();
					},
					options
				);
			} else {
				services.notificationService.showAlert(
					STRINGS[language].labels.location_not_available,
					STRINGS[language].labels.error
				);
				services.notificationService.hideProgressDialog();
			}
		}

		onMounted(async () => {
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
			...icons,
			...methods
		};
	}
};
</script>

<style lang="scss">
</style>