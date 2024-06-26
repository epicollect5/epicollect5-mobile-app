<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header class="question-label">
			<ion-card-title>
				{{state.question}}
			</ion-card-title>
			<ion-card-subtitle class="ion-text-right">
				{{labels.format}}:&nbsp;{{state.inputDetails.datetime_format}}</ion-card-subtitle>
		</ion-card-header>
		<ion-card-content
			:class="{'ion-margin' : isGroupInput}"
			class="ion-text-center"
		>
			<div
				class="question-required"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>
			<!-- todo: could extract the chip component -->
			<!-- Show the WEB chip in browsers and in devices when seconds are not needed -->
			<!-- todo: on PWA use https://vue3datepicker.com/ -->
			<ion-chip
				v-if="isPWA || ((isANDROID || isIOS) && !hasSeconds)"
				class="chip-datetimepicker web-datetime"
				:class="{'has-error' : hasError, 'web-picker': isPWA, 'device-picker': !isPWA}"
				outline
				mode="ios"
			>
				<div class="datetime-value">
					<ion-icon
						v-if="!isPWA"
						class="time-icon"
						size="small"
						:icon="timeOutline"
					></ion-icon>
					<input
						v-if="hasSeconds"
						type="time"
						step="1"
						class="question-input question-datetimepicker"
						v-model.trim="state.time.answer"
						@change="getTime()"
					/>
					<input
						v-else
						type="time"
						class="question-input question-datetimepicker"
						v-model.trim="state.time.answer"
						@change="getTime()"
					/>
				</div>
				<ion-icon
					size="large"
					:icon="closeOutline"
					@click="clearTime(false)"
				></ion-icon>
			</ion-chip>

			<!-- Show the native wheel picker only when seconds are needed -->
			<!-- We do this to show the scroll picker only for formats with seconds -->
			<!-- Formats with only hours and minutes get the clock native UI -->
			<!-- given by input type time  -->
			<ion-chip
				v-if="(isANDROID || isIOS) && hasSeconds"
				class="chip-datetimepicker device-datetime"
				:class="{'has-error' : hasError}"
				outline
				mode="ios"
			>
				<div class="datetime-value">
					<ion-icon
						class="time-icon"
						size="small"
						:icon="timeOutline"
					></ion-icon>
					<input
						readonly
						type="text"
						class="question-input question-datetimepicker question-datetimepicker-native"
						v-model.trim="state.time.answerPicker"
						@click="openTimePicker()"
					/>
				</div>
				<ion-icon
					size="large"
					:icon="closeOutline"
					@click="clearTime(true)"
				></ion-icon>
			</ion-chip>

			<div>
				<div>{{labels.time_selected_is}}
					<strong>{{state.userFormattedTime === '' ? ' --- ' : state.userFormattedTime}}</strong>
				</div>
			</div>
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
import { useRootStore } from '@/stores/root-store';
import { closeOutline, timeOutline } from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import { PARAMETERS } from '@/config';
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
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
			default: false
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
			time: {
				answer: '',
				answerPicker: ''
			},
			userFormattedTime: '',
			inputFormattedTime: null,
			pickerFormattedTime: ''
		});

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		let today;
		state.datetime_format = state.inputDetails.datetime_format;
		state.time.answer = '';
		state.time.answerPicker = '';

		//IMP: for the web (input type time)
		//The value of the time input is always in 24-hour format that includes leading zeros: hh:mm,
		//regardless of the input format, which is likely to be selected based on the user's locale
		//(or by the user agent).
		//If the time includes seconds (see Using the step attribute),
		//the format is always hh:mm:ss

		// Display cached answer formatted based on what the user selected on the formbuilder
		if (state.answer.answer === '') {
			state.userFormattedTime = '';
		} else {
			//Get time regardless of timezone and daylight saving
			state.userFormattedTime = utilsService.getUserFormattedTime(
				state.answer.answer,
				state.inputDetails.datetime_format
			);

			//show a "static" time in the time picker, i.e. no timezone parsing, no daylight
			state.inputFormattedTime = utilsService.getInputFormattedTime(
				state.answer.answer,
				state.inputDetails.datetime_format
			);

			state.pickerFormattedTime = utilsService.getPickerFormattedTime(
				state.answer.answer,
				state.inputDetails.datetime_format
			);

			state.time.answer = state.inputFormattedTime;
			state.time.answerPicker = state.pickerFormattedTime;
		}

		// Set to default datetime if requested. We remove the timezone and set it as UTC, grabbing local hh and mm
		if (state.inputDetails.set_to_current_datetime && state.answer.answer === '') {
			today = new Date();
			//get time locale to display to user
			//imp: toISOString() return UTC, so we are using a custom function
			//imp to get a locale ISO string
			state.inputFormattedTime = utilsService.getInputFormattedTime(
				utilsService.toISOStringLocale(today),
				state.inputDetails.datetime_format
			);
			state.pickerFormattedTime = utilsService.getPickerFormattedTime(
				utilsService.toISOStringLocale(today),
				state.inputDetails.datetime_format
			);

			//parse today's date to remove timezone -> we save the time locale without the timezone
			state.answer.answer = utilsService.getISOTime(today, state.inputDetails.datetime_format);
			//strip milliseconds for time picker display
			state.time.answer = state.inputFormattedTime;
			state.time.answerPicker = state.pickerFormattedTime;
			state.userFormattedTime = utilsService.getUserFormattedTime(
				state.answer.answer,
				state.inputDetails.datetime_format
			);
		}

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
			//show step attribute only if the time format has seconds
			hasSeconds: computed(() => {
				return [
					PARAMETERS.TIME_FORMAT_1,
					PARAMETERS.TIME_FORMAT_2,
					PARAMETERS.TIME_FORMAT_5
				].includes(state.inputDetails.datetime_format);
			}),

			displayFormat: computed(() => {
				//hack: this fixes ion-datetime not showing 24 hours for hh:mm format
				if (state.inputDetails.datetime_format === PARAMETERS.TIME_FORMAT_2) {
					return state.inputDetails.datetime_format.replace('hh', 'HH');
				}
				return state.inputDetails.datetime_format;
			}),
			isANDROID: computed(() => {
				return rootStore.device.platform === PARAMETERS.ANDROID;
			}),
			isIOS: computed(() => {
				return rootStore.device.platform === PARAMETERS.IOS;
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

		const methods = {
			openTimePicker() {
				let currentHours;
				let currentMinutes;
				let currentSeconds;
				let defaultItems;
				let items;

				const pickerData = {
					hours: utilsService.getHoursColumnPicker(),
					minutes: utilsService.getMinutesColumnPicker(),
					seconds: utilsService.getSecondsColumnPicker()
				};

				if (state.time.answerPicker) {
					if (state.inputDetails.datetime_format === PARAMETERS.TIME_FORMAT_5) {
						currentMinutes = parseInt(state.time.answerPicker.slice(0, 2));
						currentSeconds = parseInt(state.time.answerPicker.slice(3, 5));
					} else {
						currentHours = parseInt(state.time.answerPicker.slice(0, 2));
						currentMinutes = parseInt(state.time.answerPicker.slice(3, 5));
						currentSeconds = parseInt(state.time.answerPicker.slice(6, 8));
					}
				} else {
					today = new Date();
					currentHours = today.getHours();
					currentMinutes = today.getMinutes();
					currentSeconds = today.getSeconds();
				}
				if (state.inputDetails.datetime_format === PARAMETERS.TIME_FORMAT_5) {
					//show only mm::ss
					items = [[pickerData.minutes], [pickerData.seconds]];
					defaultItems = {
						0: pickerData.minutes[currentMinutes].description,
						1: pickerData.seconds[currentSeconds].description
					};
				} else {
					//show hh:mm:ss
					items = [[pickerData.hours], [pickerData.minutes], [pickerData.seconds]];
					defaultItems = {
						0: pickerData.hours[currentHours].description,
						1: pickerData.minutes[currentMinutes].description,
						2: pickerData.seconds[currentSeconds].description
					};
				}

				const config = {
					title: state.inputDetails.datetime_format,
					items,
					wrapWheelText: true,
					positiveButtonText: labels.confirm,
					negativeButtonText: labels.dismiss,
					defaultItems
				};

				window.SelectorCordovaPlugin.showSelector(
					config,
					function (results) {
						if (state.inputDetails.datetime_format === PARAMETERS.TIME_FORMAT_5) {
							currentHours = 0;
							currentMinutes = results[0].description;
							currentSeconds = results[1].description;
						} else {
							currentHours = results[0].description;
							currentMinutes = results[1].description;
							currentSeconds = results[2].description;
						}

						// Set hours, minutes and seconds
						const currentDate = new Date();
						currentDate.setHours(currentHours, currentMinutes, currentSeconds);
						state.answer.answer = utilsService.getISOTime(
							currentDate,
							state.inputDetails.datetime_format
						);

						// set format for user
						state.userFormattedTime = utilsService.getUserFormattedTime(
							state.answer.answer,
							state.inputDetails.datetime_format
						);

						if (state.inputDetails.datetime_format === PARAMETERS.TIME_FORMAT_5) {
							state.time.answerPicker = currentMinutes + ':' + currentSeconds;
						} else {
							state.time.answerPicker = currentHours + ':' + currentMinutes + ':' + currentSeconds;
						}
					},
					function () {
						console.log('Canceled');
					}
				);
			},
			clearTime() {
				state.answer.answer = '';
				state.answer.was_jumped = false;
				state.userFormattedTime = '';
				state.inputFormattedTime = null;
				state.pickerFormattedTime = '';
				state.time.answer = '';
				state.time.answerPicker = '';
			},
			getTime() {
				//intercepts taps on "Clear" on some devices' picker
				if (state.time.answer === '') {
					methods.clearTime();
					return false;
				}

				// get ISO Date without timezone
				const today = new Date();
				const hrs = state.time.answer.substring(0, 2);
				const minutes = state.time.answer.substring(3, 5);
				const seconds = state.time.answer.substring(6, 8);

				// Set hours, minutes and seconds
				today.setHours(hrs, minutes, seconds);
				state.answer.answer = utilsService.getISOTime(today, state.inputDetails.datetime_format);
				//set format for input

				state.inputFormattedTime = utilsService.getInputFormattedTime(
					state.answer.answer,
					state.inputDetails.datetime_format
				);
				// set format for user
				state.userFormattedTime = utilsService.getUserFormattedTime(
					state.answer.answer,
					state.inputDetails.datetime_format
				);
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			...props,
			//icons
			closeOutline,
			timeOutline
		};
	}
};
</script>

<style lang="scss" scoped>
</style>