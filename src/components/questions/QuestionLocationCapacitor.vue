<template>
	<ion-card class="question-card animate__animated animate__fadeIn">
		<ion-card-header class="question-label">
			<ion-card-title>
				{{state.question}}
			</ion-card-title>
		</ion-card-header>
		<ion-card-content
			class="ion-text-center"
			:class="{'ion-margin' : isGroupInput}"
		>
			<grid-question-wide>
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

			<ion-grid class="question-location-grid">
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
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import GridQuestionWide from '@/components/GridQuestionWide';
import { Geolocation } from '@capacitor/geolocation';

export default {
	components: {
		GridQuestionWide
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

		//set up question
		services.questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		const computedScope = {
			hasError: computed(() => {
				return services.utilsService.hasQuestionError(state);
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

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
		});

		function _getCoords() {
			console.log('TIMEOUT SHOULD BE -> ', services.locationService.getWatchTimeout());

			const interval_ID = setInterval(async function() {
				// did we timeout/errors??
				if (rootStore.deviceGeolocation.error) {
					//deal with error
					clearInterval(interval_ID);

					//try a getCurrentPosition
					try {
						const geoResult = await Geolocation.getCurrentPosition(
							// function(position) {
							// 	rootStore.deviceGeolocation = {
							// 		...rootStore.deviceGeolocation,
							// 		...{ position: position.coords }
							// 	};

							// 	services.notificationService.hideProgressDialog();
							// },

							{
								maximumAge: 0,
								timeout: services.locationService.getWatchTimeout(),
								enableHighAccuracy: false
							}
						);

						console.log(geoResult);

						rootStore.deviceGeolocation = {
							...rootStore.deviceGeolocation,
							...{ position: geoResult.coords }
						};
					} catch (error) {
						console.log(error);
						services.notificationService.hideProgressDialog();
						services.notificationService.showAlert(
							STRINGS[language].labels.location_fail,
							error.message
						);
					}
				} else {
					//check whether we have a value yet
					if (rootStore.deviceGeolocation.position) {
						//toFixed(6) rounds the co-ords to 6 digits, which is cm accuracy
						state.answer.answer.latitude = rootStore.deviceGeolocation.position.latitude.toFixed(6);
						state.answer.answer.longitude = rootStore.deviceGeolocation.position.longitude.toFixed(
							6
						);
						state.answer.answer.accuracy = Math.round(
							rootStore.deviceGeolocation.position.accuracy
						);

						clearInterval(interval_ID);
						services.notificationService.hideProgressDialog();
					}
					console.log('cannot get location yet');
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
					services.notificationService.showAlert('Not availble on web debug.');
					return;
				}

				if (rootStore.geolocationPermission) {
					if (rootStore.device.platform === PARAMETERS.WEB) {
						//running function until we get a position, then refresh UI
						await services.notificationService.showProgressDialog(
							STRINGS[language].labels.acquiring_position,
							STRINGS[language].labels.wait
						);
						_getCoords();
						return;
					}

					//check if location is enabled (edge case when the user disable location and then go back to the app)
					cordova.plugins.diagnostic.isLocationAvailable(
						async function(isAvailable) {
							if (isAvailable) {
								//running function until we get a position, then refresh UI
								await services.notificationService.showProgressDialog(
									STRINGS[language].labels.acquiring_position,
									STRINGS[language].labels.wait
								);
								_getCoords();
							} else {
								rootStore.geolocationPermission = false;
								services.notificationService.showAlert(
									STRINGS[language].labels.location_not_available,
									STRINGS[language].labels.error
								);
							}
						},
						function(error) {
							console.log(error);
							services.notificationService.showAlert(
								STRINGS[language].labels.location_fail,
								STRINGS[language].labels.error
							);
						}
					);
				} else {
					if (rootStore.device.platform !== PARAMETERS.WEB) {
						//check if location is enabled
						cordova.plugins.diagnostic.isLocationAvailable(
							function(isAvailable) {
								if (isAvailable) {
									rootStore.deviceGeolocation = {
										...rootStore.deviceGeolocation,
										...{
											location: true,
											error: undefined,
											position: undefined
										}
									};

									services.locationService.startWatching();
									methods.updateLocation();
								} else {
									rootStore.geolocationPermission = false;
									services.notificationService.showAlert(
										STRINGS[language].labels.location_not_available,
										STRINGS[language].labels.error
									);
								}
							},
							function(error) {
								console.log(error);
								services.notificationService.showAlert(
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
			...icons,
			...computedScope,
			...methods,
			...props
		};
	}
};
</script>

<style lang="scss" scoped>
.question-location-grid {
	//font-size: 14px;
	text-transform: uppercase;
	ion-row.border-bottom {
		border-bottom: 1px solid var(--ion-color-light-shade);
	}
}
</style>