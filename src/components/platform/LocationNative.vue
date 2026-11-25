<template>
	<ion-card
		class="question-card"
		:class="{ 'animate__animated animate__fadeIn': !isGroupInput }"
	>
		<ion-card-header class="question-label force-no-padding">
			<ion-card-title>
				<question-label-action
					:disabled="false"
					action="location"
					:questionText="state.question"
					@on-label-button-click="openPopover"
				></question-label-action>
			</ion-card-title>
		</ion-card-header>
		<ion-card-content
			class="ion-text-center"
			:class="{ 'ion-margin': isGroupInput }"
		>
			<grid-question-wide>
				<template #content>
					<ion-button
						class="question-action-button ion-text-nowrap"
						color="secondary"
						expand="block"
						@click="updateLocation()"
					>
						<ion-icon
							slot="start"
							:icon="locate"
						></ion-icon>
						{{ labels.update_location }}
					</ion-button>
				</template>
			</grid-question-wide>

			<ion-grid class="question-location-grid">
				<ion-row class="ion-align-items-center border-bottom">
					<ion-col>
						<div class="ion-text-end">
							<strong>{{ labels.latitude }}&nbsp;</strong>
						</div>
					</ion-col>
					<ion-col>
						<div class="ion-text-start">
							&nbsp;{{ latitude }}
						</div>
					</ion-col>
				</ion-row>
				<ion-row class="ion-align-items-center border-bottom">
					<ion-col>
						<div class="ion-text-end">
							<strong>{{ labels.longitude }}&nbsp;</strong>
						</div>
					</ion-col>
					<ion-col>
						<div class="ion-text-start">
							&nbsp;{{ longitude }}
						</div>
					</ion-col>
				</ion-row>
				<ion-row class="ion-align-items-center border-bottom">
					<ion-col>
						<div class="ion-text-end">
							<strong>{{ labels.accuracy }}&nbsp;</strong>
						</div>
					</ion-col>
					<ion-col>
						<div class="ion-text-start">
							&nbsp;{{ accuracy }}
						</div>
					</ion-col>
				</ion-row>
			</ion-grid>

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
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { locate } from 'ionicons/icons';
import { computed } from '@vue/reactivity';
import GridQuestionWide from '@/components/GridQuestionWide';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { locationService } from '@/services/utilities/location-cordova-service';
import { popoverLocationHandler } from '@/use/questions/popover-location-handler';

/**
 * imp: we use Cordova implementation (basically Geolocatiom API https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
 * imp: since using Capacitor, it never times out when it is not able to get a lock
 */
export default {
	components: {
		GridQuestionWide,
		QuestionLabelAction
	},
	props: {
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
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = props.parentState;

		const computedScope = {
			hasError: computed(() => {
				return utilsService.hasQuestionError(state);
			}),
			errorMessage: computed(() => {
				if (Object.keys(state.error.errors).length > 0) {
					return state.error?.errors[state.currentInputRef]?.message;
				} else {
					return '';
				}
			}),
			latitude: computed(() => {
				if (state.answer?.answer?.latitude) {
					if (state.answer.answer.latitude === '') {
						return labels.not_located_yet;
					} else {
						return state.answer.answer.latitude;
					}
				}
				return labels.not_located_yet;
			}),
			longitude: computed(() => {
				if (state.answer?.answer?.longitude) {
					if (state.answer.answer.longitude === '') {
						return labels.not_located_yet;
					} else {
						return state.answer.answer.longitude;
					}
				}
				return labels.not_located_yet;
			}),
			accuracy: computed(() => {
				if (state.answer?.answer?.accuracy) {
					if (state.answer.answer.accuracy === '') {
						return labels.not_located_yet;
					} else {
						return state.answer.answer.accuracy;
					}
				}
				return labels.not_located_yet;
			})
		};

		function _getCoords() {
			const interval_ID = setInterval(function () {
				// did we timeout/errors??
				if (rootStore.deviceGeolocation.error) {
					//deal with error
					clearInterval(interval_ID);

					//try a getCurrentPosition
					navigator.geolocation.getCurrentPosition(
						function (position) {
							rootStore.deviceGeolocation = {
								...rootStore.deviceGeolocation,
								...{ position: position.coords }
							};
							//same answer fill as the poll loop below: the interval is
							//already stopped when the watch errored, so this callback is
							//the only chance to move the recovered coords into the answer
							state.answer.answer.latitude = rootStore.deviceGeolocation.position.latitude.toFixed(6);
							state.answer.answer.longitude =
								rootStore.deviceGeolocation.position.longitude.toFixed(6);
							state.answer.answer.accuracy = Math.round(
								rootStore.deviceGeolocation.position.accuracy
							);
							notificationService.hideProgressDialog();
							rootStore.isLocationModalActive = false;
						},
						function (error) {
							//timeout

							console.log(error);
							notificationService.hideProgressDialog();
							rootStore.isLocationModalActive = false;
							notificationService.showAlert(STRINGS[language].labels.location_fail, error.message);
						},
						{
							maximumAge: 0,
							timeout: locationService.getWatchTimeout(),
							enableHighAccuracy: false
						}
					);
				} else {
					//check whether we have a value yet
					if (rootStore.deviceGeolocation.position) {
						//toFixed(6) rounds the co-ords to 6 digits, which is cm accuracy
						state.answer.answer.latitude = rootStore.deviceGeolocation.position.latitude.toFixed(6);
						state.answer.answer.longitude =
							rootStore.deviceGeolocation.position.longitude.toFixed(6);
						state.answer.answer.accuracy = Math.round(
							rootStore.deviceGeolocation.position.accuracy
						);

						clearInterval(interval_ID);
						notificationService.hideProgressDialog();
						rootStore.isLocationModalActive = false;
					}
				}
			}, PARAMETERS.DELAY_MEDIUM);
		}

		const methods = {
			async updateLocation() {
				rootStore.deviceGeolocation = {
					...rootStore.deviceGeolocation,
					...{ error: null }
				};

				if (rootStore.device.platform === PARAMETERS.WEB && PARAMETERS.DEBUG) {
					//running function until we get a position, then refresh UI
					await notificationService.showAlert('Not availble on web debug.');
					return;
				}

				if (rootStore.geolocationPermission) {
					if (rootStore.device.platform === PARAMETERS.WEB) {
						//running function until we get a position, then refresh UI
						await notificationService.showProgressDialog(
							STRINGS[language].labels.acquiring_position,
							STRINGS[language].labels.wait
						);
						rootStore.isLocationModalActive = true;
						_getCoords();
						return;
					}

					//check if location is enabled (edge case when the user disable location and then go back to the app)
					cordova.plugins.diagnostic.isLocationAvailable(
						async function (isAvailable) {
							if (isAvailable) {
								//running function until we get a position, then refresh UI
								await notificationService.showProgressDialog(
									STRINGS[language].labels.acquiring_position,
									STRINGS[language].labels.wait
								);
								rootStore.isLocationModalActive = true;
								_getCoords();
							} else {
								rootStore.geolocationPermission = false;
								await notificationService.showAlert(
                    STRINGS[language].labels.location_not_available,
                    STRINGS[language].labels.error
                );
							}
						},
						function (error) {
							console.log(error);
							notificationService.showAlert(
								STRINGS[language].labels.location_fail,
								STRINGS[language].labels.error
							);
						}
					);
				} else {
					if (rootStore.device.platform !== PARAMETERS.WEB) {
						//check if location is enabled
						cordova.plugins.diagnostic.isLocationAvailable(
							function (isAvailable) {
								if (isAvailable) {
									rootStore.deviceGeolocation = {
										...rootStore.deviceGeolocation,
										...{
											location: true,
											error: undefined,
											position: undefined
										}
									};

									locationService.startWatching();
									methods.updateLocation();
								} else {
									rootStore.geolocationPermission = false;
									notificationService.showAlert(
										STRINGS[language].labels.location_not_available,
										STRINGS[language].labels.error
									);
								}
							},
							function (error) {
								console.log(error);
								notificationService.showAlert(
									STRINGS[language].labels.location_fail,
									STRINGS[language].labels.error
								);
							}
						);
					}
				}
			},
			openPopover() {
				popoverLocationHandler({
					state
				});
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			...props,
			//icons
			locate
		};
	}
};
</script>

<style src="@/theme/components/platform/LocationNative.scss" lang="scss" scoped></style>
