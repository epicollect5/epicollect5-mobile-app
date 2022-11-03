<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header
			class="question-label"
			:class="isPWA ? 'force-no-padding' : ''"
		>
			<ion-card-title v-if="isPWA">
				<question-label-action
					:disabled="false"
					action="help"
					:questionText="state.question"
					@on-label-button-click="openModalLocationHelp"
				></question-label-action>
			</ion-card-title>
			<ion-card-title v-else>
				{{state.question}}
			</ion-card-title>
		</ion-card-header>
		<ion-card-content
			class="ion-text-center"
			:class="{'ion-margin' : isGroupInput}"
		>
			<location-pwa
				v-if="isPWA"
				:inputRef="inputRef"
				:latitude="String(state.answer.answer.latitude)"
				:longitude="String(state.answer.answer.longitude)"
				:accuracy="state.answer.answer.accuracy || 0"
				@on-pwa-location-update="onPWALocationUpdate"
			></location-pwa>

			<grid-question-wide v-if=!isPWA>
				<template #content>
					<ion-button
						class="question-action-button"
						color="secondary"
						expand="block"
						@click="updateLocation()"
					>
						<ion-icon
							slot="start"
							:icon="locate"
						></ion-icon>
						{{labels.update_location}}
					</ion-button>
				</template>
			</grid-question-wide>

			<ion-grid
				v-if="!isPWA"
				class="question-location-grid"
			>
				<ion-row class="ion-align-items-center border-bottom">
					<ion-col>
						<div class="ion-text-end">
							<strong>{{labels.latitude}}</strong>
						</div>
					</ion-col>
					<ion-col>
						<div class="ion-text-start">
							{{latitude}}
						</div>
					</ion-col>
				</ion-row>
				<ion-row class="ion-align-items-center border-bottom">
					<ion-col>
						<div class="ion-text-end">
							<strong>{{labels.longitude}}</strong>
						</div>
					</ion-col>
					<ion-col>
						<div class="ion-text-start">
							{{longitude}}
						</div>
					</ion-col>
				</ion-row>
				<ion-row class="ion-align-items-center border-bottom">
					<ion-col>
						<div class="ion-text-end">
							<strong>{{labels.accuracy}}</strong>
						</div>
					</ion-col>
					<ion-col>
						<div class="ion-text-start">
							{{accuracy}}
						</div>
					</ion-col>
				</ion-row>
			</ion-grid>

			<div
				class="question-error"
				v-if="hasError"
			>
				{{errorMessage}}
			</div>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { modalController } from '@ionic/vue';
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { locate } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import GridQuestionWide from '@/components/GridQuestionWide';
import LocationPwa from '@/components/LocationPwa';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import ModalLocationHelp from '@/components/modals/ModalLocationHelp.vue';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { locationService } from '@/services/utilities/location-cordova-service';
import { questionCommonService } from '@/services/entry/question-common-service';

/**
 * imp: we use Cordova implementation (basically Geolocatiom API https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
 * imp: since using Capacitor, it never times out when it is not able to get a lock
 */
export default {
	components: {
		GridQuestionWide,
		QuestionLabelAction,
		LocationPwa
	},
	props: {
		inputRef: {
			type: String,
			required: true
		},
		type: {
			type: String,
			required: true
		},
		isGroupInput: {
			type: Boolean,
			required: true
		}
	},
	emits: ['question-mounted'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const questionType = props.type.toUpperCase();
		const entriesAddState = inject('entriesAddState');
		const state = reactive({
			inputDetails: {},
			currentInputRef: null,
			error: {
				errors: []
			},
			required: false,
			question: '',
			pattern: null,
			answer: {
				answer: '',
				was_jumped: false
			},
			confirmAnswer: {
				verify: false,
				answer: ''
			}
		});

		const scope = {};

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

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
			}),
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
		});

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
			async openModalLocationHelp() {
				scope.ModalLocationHelp = await modalController.create({
					cssClass: 'modal-location-help',
					component: ModalLocationHelp,
					showBackdrop: true,
					backdropDismiss: true,
					componentProps: {}
				});

				return scope.ModalLocationHelp.present();
			},

			onPWALocationUpdate(coords) {
				state.answer.answer.latitude = coords.latitude;
				state.answer.answer.longitude = coords.longitude;
				state.answer.answer.accuracy = coords.accuracy;
			},
			async updateLocation() {
				rootStore.deviceGeolocation = {
					...rootStore.deviceGeolocation,
					...{ error: null }
				};

				if (rootStore.device.platform === PARAMETERS.WEB && PARAMETERS.DEBUG) {
					//running function until we get a position, then refresh UI
					notificationService.showAlert('Not availble on web debug.');
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

<style lang="scss" scoped>
</style>