<template>
	<ion-grid class="ion-no-padding datetime-field-grid">
		<ion-row class="ion-align-items-center">
			<ion-col class="datetime-button-col">
				<ion-icon
					class="datetime-picker-icon"
					size="small"
					:icon="pickerIcon"
				></ion-icon>
				<ion-button
					class="question-action-button datetime-picker-button ion-text-nowrap"
					color="secondary"
					expand="block"
					:aria-label="pickerAriaLabel"
					@click="openPicker"
				>
					<span class="datetime-picker-value">{{displayValue}}</span>
				</ion-button>
			</ion-col>
			<ion-col size="auto">
				<ion-icon
					class="datetime-clear-icon"
					size="large"
					:icon="closeOutline"
					@click="clearField"
				></ion-icon>
			</ion-col>
		</ion-row>
		<input
			class="datetime-web-input"
			:type="webInputType"
			:min="webInputMin"
			:max="webInputMax"
			:step="webInputStep"
			:value="webInputValue"
			@change="onWebChange"
		/>
	</ion-grid>
</template>

<script>
import { reactive, computed } from '@vue/reactivity';
import { Capacitor } from '@capacitor/core';
import { calendarClearOutline, closeOutline, timeOutline } from 'ionicons/icons';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings.js';
import { useRootStore } from '@/stores/root-store';
import { utilsService } from '@/services/utilities/utils-service';
import { datetimePickerService } from '@/services/utilities/datetime-picker-service';

export default {
	props: {
		type: {
			type: String,
			required: true
		},
		answer: {
			type: String,
			default: ''
		},
		datetimeFormat: {
			type: String,
			default: ''
		},
		min: {
			type: String,
			default: undefined
		},
		max: {
			type: String,
			default: undefined
		},
		locale: {
			type: String,
			default: ''
		}
	},
	emits: ['change', 'clear'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language] ? STRINGS[language].labels : STRINGS.en.labels;

		const state = reactive({});

		const computedScope = {
			isNative: computed(() => {
				return Capacitor.isNativePlatform();
			}),
			hasSeconds: computed(() => {
				return [
					PARAMETERS.TIME_FORMAT_1,
					PARAMETERS.TIME_FORMAT_2,
					PARAMETERS.TIME_FORMAT_5
				].includes(props.datetimeFormat);
			}),
			pickerIcon: computed(() => {
				if (props.type === 'time') {
					return timeOutline;
				}
				return calendarClearOutline;
			}),
			pickerAriaLabel: computed(() => {
				//empty buttons have no text content for assistive technology,
				//so name them with the translated picker label; when answered
				//the formatted value itself is the accessible name
				if (computedScope.displayValue.value) {
					return null;
				}
				if (props.type === 'time') {
					return labels.time_selected_is;
				}
				return labels.date_selected_is;
			}),
			displayValue: computed(() => {
				if (!props.answer) {
					return '';
				}
				if (props.type === 'time') {
					if (!props.datetimeFormat) {
						return props.answer;
					}
					return utilsService.getUserFormattedTime(props.answer, props.datetimeFormat);
				}
				if (props.datetimeFormat) {
					return utilsService.getUserFormattedDate(props.answer, props.datetimeFormat);
				}
				return utilsService.getInputFormattedDate(props.answer);
			}),
			webInputType: computed(() => {
				if (props.type === 'time') {
					return 'time';
				}
				return 'date';
			}),
			webInputMin: computed(() => {
				if (props.type === 'date') {
					return props.min;
				}
				return undefined;
			}),
			webInputMax: computed(() => {
				if (props.type === 'date') {
					return props.max;
				}
				return undefined;
			}),
			webInputStep: computed(() => {
				//seconds need an explicit step, otherwise the browser
				//picker is minute-precision (restores legacy step="1")
				if (props.type === 'time' && computedScope.hasSeconds.value) {
					return 1;
				}
				return undefined;
			}),
			webInputValue: computed(() => {
				if (!props.answer) {
					return '';
				}
				if (props.type === 'time') {
					if (!props.datetimeFormat) {
						return props.answer;
					}
					return utilsService.getInputFormattedTime(props.answer, props.datetimeFormat);
				}
				return utilsService.getInputFormattedDate(props.answer);
			}),
			showWebInput: computed(() => {
				return !Capacitor.isNativePlatform();
			})
		};

		function getPickerValueForDate() {
			if (!props.answer) {
				return undefined;
			}
			return utilsService.getInputFormattedDate(props.answer);
		}

		function getPickerValueForTime() {
			if (!props.answer) {
				return undefined;
			}
			return utilsService.getInputFormattedTime(props.answer, props.datetimeFormat);
		}

		function getLocale() {
			if (props.locale) {
				return props.locale;
			}
			return datetimePickerService.getLocale();
		}

		function openWheelPicker() {
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
			let pickerValue = '';
			if (props.answer) {
				pickerValue = utilsService.getPickerFormattedTime(props.answer, props.datetimeFormat);
			}
			if (pickerValue) {
				if (props.datetimeFormat === PARAMETERS.TIME_FORMAT_5) {
					currentMinutes = parseInt(pickerValue.slice(0, 2));
					currentSeconds = parseInt(pickerValue.slice(3, 5));
				} else {
					currentHours = parseInt(pickerValue.slice(0, 2));
					currentMinutes = parseInt(pickerValue.slice(3, 5));
					currentSeconds = parseInt(pickerValue.slice(6, 8));
				}
			} else {
				const today = new Date();
				currentHours = today.getHours();
				currentMinutes = today.getMinutes();
				currentSeconds = today.getSeconds();
			}
			if (props.datetimeFormat === PARAMETERS.TIME_FORMAT_5) {
				items = [[pickerData.minutes], [pickerData.seconds]];
				defaultItems = {
					0: pickerData.minutes[currentMinutes].description,
					1: pickerData.seconds[currentSeconds].description
				};
			} else {
				items = [[pickerData.hours], [pickerData.minutes], [pickerData.seconds]];
				defaultItems = {
					0: pickerData.hours[currentHours].description,
					1: pickerData.minutes[currentMinutes].description,
					2: pickerData.seconds[currentSeconds].description
				};
			}
			const config = {
				title: props.datetimeFormat,
				items,
				wrapWheelText: true,
				positiveButtonText: labels.confirm,
				negativeButtonText: labels.dismiss,
				defaultItems,
				theme: datetimePickerService.getWheelTheme()
			};
			window.SelectorCordovaPlugin.showSelector(
				config,
				function (results) {
					if (props.datetimeFormat === PARAMETERS.TIME_FORMAT_5) {
						currentHours = 0;
						currentMinutes = results[0].description;
						currentSeconds = results[1].description;
					} else {
						currentHours = results[0].description;
						currentMinutes = results[1].description;
						currentSeconds = results[2].description;
					}
					const currentDate = new Date();
					currentDate.setHours(currentHours, currentMinutes, currentSeconds);
					const isoTime = utilsService.getISOTime(currentDate, props.datetimeFormat);
					context.emit('change', isoTime);
				},
				function () {
					console.log('Canceled');
				}
			);
		}

		function findWebInput(event) {
			if (event && event.currentTarget && event.currentTarget.closest) {
				const grid = event.currentTarget.closest('.datetime-field-grid');
				if (grid) {
					const input = grid.querySelector('input.datetime-web-input');
					if (input) {
						return input;
					}
				}
			}
			return document.querySelector('input.datetime-web-input');
		}

		function openWebPicker(event) {
			const input = findWebInput(event);
			if (!input) {
				return;
			}
			try {
				if (typeof input.showPicker === 'function') {
					input.showPicker();
				} else {
					input.focus();
					input.click();
				}
			} catch (error) {
				console.log(error);
				input.focus();
			}
		}

		const methods = {
			async openPicker(event) {
				if (props.type === 'date') {
					if (datetimePickerService.isSupported()) {
						const picked = await datetimePickerService.presentDate({
							value: getPickerValueForDate(),
							min: props.min,
							max: props.max,
							locale: getLocale()
						});
						if (picked === null) {
							return;
						}
						const isoDate = utilsService.getISODateOnly(picked, props.datetimeFormat);
						context.emit('change', isoDate);
					} else {
						methods.openWebPicker(event);
					}
					return;
				}
				if (props.type === 'time') {
					if (computedScope.hasSeconds.value) {
						if (datetimePickerService.isSupported()) {
							openWheelPicker();
						} else {
							methods.openWebPicker(event);
						}
						return;
					}
					if (datetimePickerService.isSupported()) {
						const picked = await datetimePickerService.presentTime({
							value: getPickerValueForTime(),
							locale: getLocale(),
							//24-hour formats need a 24-hour locale, otherwise
							//the plugin shows a 12-hour clock (see service)
							is24Hour: [
								PARAMETERS.TIME_FORMAT_1,
								PARAMETERS.TIME_FORMAT_3
							].includes(props.datetimeFormat)
						});
						if (picked === null) {
							return;
						}
						const today = new Date();
						const hrs = picked.substring(0, 2);
						const minutes = picked.substring(3, 5);
						today.setHours(hrs, minutes, 0);
						const isoTime = utilsService.getISOTime(today, props.datetimeFormat);
						context.emit('change', isoTime);
					} else {
						methods.openWebPicker(event);
					}
				}
			},
			openWebPicker(event) {
				openWebPicker(event);
			},
			onWebChange(event) {
				const value = event && event.target ? event.target.value : '';
				if (value === '') {
					context.emit('clear');
					return;
				}
				if (props.type === 'date') {
					const isoDate = utilsService.getISODateOnly(value, props.datetimeFormat);
					context.emit('change', isoDate);
					return;
				}
				const today = new Date();
				const hrs = value.substring(0, 2);
				const minutes = value.substring(3, 5);
				const seconds = value.substring(6, 8);
				today.setHours(hrs, minutes, seconds);
				const isoTime = utilsService.getISOTime(today, props.datetimeFormat);
				context.emit('change', isoTime);
			},
			clearField() {
				context.emit('clear');
			}
		};

		return {
			state,
			...computedScope,
			...methods,
			...props,
			calendarClearOutline,
			closeOutline,
			timeOutline
		};
	}
};
</script>

<style src="@/theme/components/ui/DateTimeField.scss" lang="scss"></style>
