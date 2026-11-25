<template>
	<ion-grid class="ion-no-padding">
		<ion-row>
			<ion-col
				size-xs="8"
				offset-xs="2"
				size-sm="6"
				offset-sm="3"
				size-md="4"
				offset-md="4"
				size-lg="4"
				offset-lg="4"
				class="ion-align-self-center"
			>
				<ion-button
					class="question-action-button ion-text-nowrap"
					color="secondary"
					expand="block"
					@click="scan()"
				>
					<ion-icon
						slot="start"
						:icon="scanSharp"
					></ion-icon>
					{{ labels.scan }}
				</ion-button>
				</ion-col>
			</ion-row>
		</ion-grid>
		<ion-grid class="ion-no-padding">
			<ion-row>
				<ion-col
					size-xs="12"
					offset-xs="0"
					size-sm="8"
					offset-sm="2"
					class="ion-align-self-center"
				>
					<div class="ion-margin-top">
						<input
							type="text"
							class="question-input ios-fix-border"
							:class="{ 'has-error': hasError }"
							:value="state.answer.answer"
							:placeholder="labels.type_answer_here"
							@input="onInputValueChange($event)"
						/>
						<div
							class="question-error"
							v-if="hasError"
						>
							{{ errorMessage }}
						</div>
					</div>
				</ion-col>
			</ion-row>
		</ion-grid>
	</template>

<script>
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { scanSharp } from 'ionicons/icons';
import { computed } from '@vue/reactivity';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';

export default {
	props: {
		parentState: {
			type: Object,
			required: true
		},
		isGroupInput: {
			type: Boolean
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
			})
		};

		const methods = {
			onInputValueChange(event) {
				const value = event.target.value;
				state.answer.answer = utilsService.getSanitisedAnswer(value);
			},

			async scan() {
				//show spinner and hide it immediately
				await notificationService.showProgressDialog(
					STRINGS[language].labels.preparing_scanner,
					STRINGS[language].labels.wait
				);

				// noinspection ES6MissingAwait ->deliberate, so it starts the scanner immediately
				notificationService.hideProgressDialog();

				//foreground service helps the app to not be killed
				let fsChoice = 'dismiss';
				try {
					fsChoice = await notificationService.startForegroundService();
				} catch (error) {
					console.log('Failed to start foreground service: ' + error);
				}

				//if the user left to system settings or docs, do not launch the scanner
				if (fsChoice === 'open_settings' || fsChoice === 'learn_more') {
					return;
				}

				//request camera permission
				if (rootStore.device.platform === PARAMETERS.ANDROID) {
					cordova.plugins.diagnostic.requestRuntimePermission(
						function (status) {
							if (
								cordova.plugins.diagnostic.permissionStatus.GRANTED === status
							) {
								console.log('Permission granted');

								utilsService.triggerBarcode().then(
									function (result) {
										notificationService.stopForegroundService();
										//do not override value if the scan action is cancelled by the user
										if (!result.cancelled) {
											state.answer.answer = utilsService.getSanitisedAnswer(
												result.text
											);
										}
									},
									function (error) {
										notificationService.stopForegroundService();
										if (error !== null) {
											notificationService.showAlert(
												labels.failed_because + error
											);
										}
									}
								);
							} else {
								//warn user the permission is required
								notificationService.showAlert(labels.missing_permission);
								notificationService.stopForegroundService();
							}
						},
						function (error) {
							notificationService.stopForegroundService();
							notificationService.showAlert(error);
						},
						cordova.plugins.diagnostic.permission.CAMERA
					);
				} else {
					//ios
					cordova.plugins.diagnostic.isCameraAuthorized(
						function (response) {
							if (response) {
								utilsService.triggerBarcode().then(
									function (result) {
										//do not override value if the scan action is cancelled by the user
										if (!result.cancelled) {
											state.answer.answer = utilsService.getSanitisedAnswer(
												result.text
											);
										}
									},
									function (error) {
										notificationService.showAlert(
											labels.failed_because + error
										);
									}
								);
							} else {
								//request permission
								cordova.plugins.diagnostic.requestCameraAuthorization(
									function (permission) {
										console.log(permission);
										//on iOS permission is true or false only
										if (permission) {
											//scan
											utilsService.triggerBarcode().then(
												function (result) {
													//do not override value if the scan action is cancelled by the user
													if (!result.cancelled) {
														state.answer.answer =
															utilsService.getSanitisedAnswer(result.text);
													}
												},
												function (error) {
													notificationService.showAlert(
														labels.failed_because + error
													);
												}
											);
										} else {
											notificationService.showAlert(labels.missing_permission);
										}
									},
									function () {
										notificationService.showAlert(labels.missing_permission);
									}
								);
							}
						},
						function (error) {
							console.error(error);
							notificationService.showAlert(error);
						}
					);
				}
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			//icons
			scanSharp
		};
	}
};
</script>
